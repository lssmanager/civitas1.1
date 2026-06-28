const {
  ORGANIZATION_ADMIN_ROLE_NAME,
  JIT_DEFAULT_ORGANIZATION_ROLE_NAME,
  addUserToLogtoOrganization,
  assignOrganizationRoleToUser,
  createOrResolveLogtoUserByEmail,
  ensureOrganizationTemplate,
  findOrganizationRoleByName,
  replaceJitDefaultRolesForLogtoOrganization,
  replaceJitEmailDomainsForLogtoOrganization,
} = require("./logtoManagement");
const {
  buildOrganizationCreatePayload,
  buildUserCreatePayload,
  buildLogtoUsername,
} = require("./organizationProvisioningPayloads");
const { normalizeProvisioningSettings } = require("./organizationProvisioningSettings");

const emptyToNull = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const normalizeRoleNames = (value, fallback = [JIT_DEFAULT_ORGANIZATION_ROLE_NAME]) => {
  const input = Array.isArray(value) ? value : fallback;
  const roles = input
    .map((role) => (typeof role === "string" ? role.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(roles.length > 0 ? roles : fallback));
};

const normalizePhone = (value) => {
  const raw = emptyToNull(value);
  if (!raw) return null;
  const compact = raw.replace(/[\s().-]+/g, "");
  if (!/^\+?[1-9]\d{6,14}$/.test(compact)) return null;
  return compact.startsWith("+") ? compact : `+${compact}`;
};

const normalizeAdministrativeContacts = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((contact, index) => {
      const firstName = emptyToNull(contact?.firstName) || emptyToNull(contact?.primerNombre);
      const middleName = emptyToNull(contact?.middleName) || emptyToNull(contact?.segundoNombre);
      const firstSurname =
        emptyToNull(contact?.firstSurname) ||
        emptyToNull(contact?.primerApellido) ||
        emptyToNull(contact?.lastName);
      const secondSurname =
        emptyToNull(contact?.secondSurname) || emptyToNull(contact?.segundoApellido);
      const email = emptyToNull(contact?.email)?.toLowerCase() || null;
      return {
        key:
          (typeof contact?.key === "string" && contact.key.trim()) ||
          `administrative_contact_${index + 1}`,
        firstName,
        middleName,
        firstSurname,
        secondSurname,
        name:
          emptyToNull(contact?.name) ||
          [firstName, middleName, firstSurname, secondSurname]
            .filter(Boolean)
            .join(" ") ||
          null,
        email,
        phone: normalizePhone(contact?.phone),
        phoneExtension: emptyToNull(contact?.phoneExtension ?? contact?.extension),
        position: emptyToNull(contact?.position),
        organizationRoleName:
          emptyToNull(contact?.organizationRoleName) || ORGANIZATION_ADMIN_ROLE_NAME,
        username:
          emptyToNull(contact?.username) || buildLogtoUsername({ email }),
      };
    })
    .filter((contact) => contact.name || contact.email || contact.phone || contact.position);

const getAdministrativeContactUniquenessErrors = (contacts = []) => {
  const seen = new Map();
  const errors = [];
  for (const [index, contact] of contacts.entries()) {
    if (!contact.email) continue;
    if (seen.has(contact.email)) {
      errors.push({
        field: `administrativeContacts.${index}.email`,
        message: `Administrative contacts must use unique emails. ${contact.email} is repeated.`,
      });
      continue;
    }
    seen.set(contact.email, true);
  }
  return errors;
};

function normalizeProvisioningInput(body = {}) {
  const settings = normalizeProvisioningSettings(body);
  const administrativeContacts = normalizeAdministrativeContacts(body.administrativeContacts);
  const jitDefaultRoleNames = normalizeRoleNames(
    body.jitProvisioning?.defaultRoleNames,
    [JIT_DEFAULT_ORGANIZATION_ROLE_NAME],
  );

  const errors = [];
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : undefined;

  if (!name) {
    errors.push({ field: "name", message: "Organization name is required" });
  }

  if (administrativeContacts.length === 0) {
    errors.push({ field: "administrativeContacts", message: "At least one administrative contact is required" });
  }

  administrativeContacts.forEach((contact, index) => {
    if (!contact.firstName) {
      errors.push({ field: `administrativeContacts.${index}.firstName`, message: "Administrative contact first name is required" });
    }
    if (!contact.firstSurname) {
      errors.push({ field: `administrativeContacts.${index}.firstSurname`, message: "Administrative contact first surname is required" });
    }
    if (!contact.email) {
      errors.push({ field: `administrativeContacts.${index}.email`, message: "Administrative contact email is required" });
    }
    if (!contact.organizationRoleName) {
      errors.push({ field: `administrativeContacts.${index}.organizationRoleName`, message: "Administrative contact role is required" });
    }
  });

  errors.push(...settings.errors);
  errors.push(...getAdministrativeContactUniquenessErrors(administrativeContacts));

  return {
    errors,
    value: {
      canonical: {
        name,
        description,
        administrativeContacts,
        jitProvisioning: {
          domain: settings.value.adminDomain,
          defaultRoleNames: jitDefaultRoleNames,
        },
      },
      settings: settings.value,
      business: body.business && typeof body.business === "object" ? body.business : {},
      segmentation:
        body.segmentation && typeof body.segmentation === "object"
          ? body.segmentation
          : {},
    },
  };
}

const getRoleId = (role = {}) => role.id || role.organizationRoleId || role.roleId || null;
const getUserId = (user = {}) => user.id || user.userId || user.logtoUserId || null;

async function runCanonicalOrganizationProvisioning({ input }) {
  const requiredRoleNames = Array.from(
    new Set([
      ...input.canonical.jitProvisioning.defaultRoleNames,
      ...input.canonical.administrativeContacts.map((contact) => contact.organizationRoleName),
    ]),
  );

  const template = await ensureOrganizationTemplate({ requiredRoleNames });
  const organization = await createOrganizationFromCanonicalInput(input);
  const organizationId = organization.id;

  const jitRoleIds = [];
  for (const roleName of input.canonical.jitProvisioning.defaultRoleNames) {
    const role = await findOrganizationRoleByName(roleName);
    const roleId = getRoleId(role);
    if (!roleId) {
      throw new Error(`Logto organization role ${roleName} exists but no role id was returned`);
    }
    jitRoleIds.push(roleId);
  }

  await replaceJitEmailDomainsForLogtoOrganization({
    organizationId,
    emailDomains: [input.canonical.jitProvisioning.domain],
  });
  await replaceJitDefaultRolesForLogtoOrganization({
    organizationId,
    organizationRoleIds: jitRoleIds,
  });

  const administrativeContactAssignments = [];
  for (const contact of input.canonical.administrativeContacts) {
    const resolved = await createOrResolveLogtoUserByEmail(
      buildUserCreatePayload(contact),
    );
    const userId = getUserId(resolved.user);
    if (!userId) {
      throw new Error(`Administrative contact ${contact.email} did not resolve a Logto user id`);
    }
    const role = await findOrganizationRoleByName(contact.organizationRoleName);
    const roleId = getRoleId(role);
    if (!roleId) {
      throw new Error(`Logto organization role ${contact.organizationRoleName} exists but no role id was returned`);
    }

    await addUserToLogtoOrganization({ organizationId, userId });
    await assignOrganizationRoleToUser({
      organizationId,
      userId,
      organizationRoleId: roleId,
      organizationRoleName: contact.organizationRoleName,
    });

    administrativeContactAssignments.push({
      key: contact.key,
      email: contact.email,
      logtoUserId: userId,
      roleName: contact.organizationRoleName,
      userCreated: Boolean(resolved.created),
      userSource: resolved.source,
      membershipAdded: true,
      roleAssigned: true,
    });
  }

  return {
    organization,
    organizationId,
    template,
    jitProvisioning: {
      domain: input.canonical.jitProvisioning.domain,
      defaultRoleNames: input.canonical.jitProvisioning.defaultRoleNames,
      defaultRoleIds: jitRoleIds,
    },
    administrativeContactAssignments,
    status: "created_with_logto_bootstrap",
  };
}

function createOrganizationFromCanonicalInput(input) {
  return require("./logtoManagement").createLogtoOrganization(
    buildOrganizationCreatePayload({
      canonical: input.canonical,
      settings: input.settings,
      business: input.business,
      segmentation: input.segmentation,
    }),
  );
}

module.exports = {
  ORGANIZATION_ADMIN_ROLE_NAME,
  JIT_DEFAULT_ORGANIZATION_ROLE_NAME,
  normalizeProvisioningInput,
  runCanonicalOrganizationProvisioning,
};