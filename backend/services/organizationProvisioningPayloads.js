const trim = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const unique = (values) => [
  ...new Set((Array.isArray(values) ? values : []).map(trim).filter(Boolean)),
];

const cleanObject = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        !(Array.isArray(value) && value.length === 0),
    ),
  );

function buildLogtoUsername({ email }) {
  const localPart = String(email || "").split("@")[0] || "";
  return String(localPart)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^([^a-z_])/, "_$1")
    .replace(/^_+$/, "") || null;
}

function buildAdministrativeContactsCustomData(contacts = []) {
  return (Array.isArray(contacts) ? contacts : [])
    .map((contact) =>
      cleanObject({
        key: trim(contact?.key),
        firstName: trim(contact?.firstName),
        middleName: trim(contact?.middleName),
        firstSurname: trim(contact?.firstSurname),
        secondSurname: trim(contact?.secondSurname),
        name: trim(contact?.name),
        email: trim(contact?.email)?.toLowerCase(),
        phone: trim(contact?.phone),
        phoneExtension: trim(contact?.phoneExtension),
        position: trim(contact?.position),
        organizationRoleName: trim(contact?.organizationRoleName),
        username: trim(contact?.username) || buildLogtoUsername({ email: contact?.email }),
      }),
    )
    .filter((contact) => Object.keys(contact).length > 0);
}

function buildOrganizationCustomData({ canonical = {}, settings = {}, business = {}, segmentation = {} } = {}) {
  const administrativeContacts = buildAdministrativeContactsCustomData(canonical.administrativeContacts);
  const primaryContact = administrativeContacts.find((contact) => contact.email || contact.name) || null;
  const tags = unique(segmentation.tags);
  const lists = unique(segmentation.lists);
  const companyName = trim(canonical.name);

  return cleanObject({
    provisioning: cleanObject({
      entryUrl: settings.entryUrl,
      appSubdomain: settings.appSubdomain,
      appBaseDomain: settings.appBaseDomain,
      institutionalDomain: settings.adminDomain,
      jitDefaultRoleNames: unique(canonical.jitProvisioning?.defaultRoleNames),
    }),
    oidcRedirectUri: settings.oidcRedirectUri || null,
    civitasProfile: cleanObject({
      contact: cleanObject({
        email: trim(primaryContact?.email),
        owner: trim(primaryContact?.name),
        phone: trim(primaryContact?.phone),
      }),
      version: 1,
      business: cleanObject({
        nit: trim(business.nit),
        city: trim(business.city),
        type: trim(business.type),
        state: trim(business.state),
        country: trim(business.country),
        website: trim(business.website),
        entryUrl: settings.entryUrl,
        industry: trim(business.industry),
        postalCode: trim(business.postalCode),
        addressLine1: trim(business.addressLine1),
        addressLine2: trim(business.addressLine2),
        appSubdomain: settings.appSubdomain,
        appBaseDomain: settings.appBaseDomain,
        numberOfEmployees: trim(business.numberOfEmployees),
        verificationDigit: trim(business.verificationDigit),
        institutionalDomain: settings.adminDomain,
        about: trim(business.about),
        description: trim(business.description) || canonical.description || null,
      }),
      administrativeContacts,
      downstream: cleanObject({
        crm: cleanObject({
          tags,
          lists,
          companyName,
          segmentation: cleanObject({
            organizationTags: tags,
            organizationLists: lists,
          }),
        }),
      }),
      segmentation: cleanObject({
        tags,
        lists,
      }),
    }),
  });
}

function buildOrganizationCreatePayload({ canonical = {}, settings = {}, business = {}, segmentation = {} } = {}) {
  return cleanObject({
    name: canonical.name,
    description:
      canonical.description || trim(business.description) || undefined,
    customData: buildOrganizationCustomData({ canonical, settings, business, segmentation }),
  });
}

function buildUserCreatePayload(person = {}) {
  const firstName = trim(person.firstName);
  const middleName = trim(person.middleName);
  const firstSurname = trim(person.firstSurname);
  const secondSurname = trim(person.secondSurname);
  const fullName = [firstName, middleName, firstSurname, secondSurname]
    .filter(Boolean)
    .join(" ");
  const phoneExtension = trim(person.phoneExtension);
  const username = trim(person.username) || buildLogtoUsername({ email: person.email });

  return cleanObject({
    primaryEmail: trim(person.email)?.toLowerCase(),
    primaryPhone: phoneExtension ? null : trim(person.phone),
    username,
    name: trim(person.name) || fullName || null,
    profile: cleanObject({
      familyName: firstSurname,
      givenName: firstName,
      middleName,
      preferredUsername: username,
    }),
    customData: cleanObject({
      civitasProfile: cleanObject({
        phone: trim(person.phone),
        source: "owner_organization_provisioning",
        position: trim(person.position),
        key: trim(person.key),
        organizationRoleName: trim(person.organizationRoleName),
        phoneExtension,
        fullName: fullName || null,
      }),
      secondFamilyName: secondSurname,
    }),
  });
}

module.exports = {
  buildLogtoUsername,
  buildAdministrativeContactsCustomData,
  buildOrganizationCustomData,
  buildOrganizationCreatePayload,
  buildUserCreatePayload,
};