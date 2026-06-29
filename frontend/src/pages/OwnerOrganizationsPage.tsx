import { useEffect, useMemo, useState } from "react";
import Topbar from "../components/Topbar";
import { useOwnerApi, type CreateOwnerOrganizationInput } from "../api/owner";

const APP_BASE_DOMAINS = ["didaxus.com", "socialstudies.cloud", "learnsocialstudies.com"] as const;

type GeographyRegion = {
  code: string;
  name: string;
  cities: readonly string[];
};

type GeographyCountry = {
  code: string;
  name: string;
  phonePrefix: string;
  regionLabel: string;
  regions: readonly GeographyRegion[];
};

const COUNTRY_OPTIONS: readonly GeographyCountry[] = [
  {
    code: "CO",
    name: "Colombia",
    phonePrefix: "+57",
    regionLabel: "Department",
    regions: [
      { code: "ANT", name: "Antioquia", cities: ["Medellin", "Envigado", "Bello"] },
      { code: "DC", name: "Bogota D.C.", cities: ["Bogota"] },
      { code: "CUN", name: "Cundinamarca", cities: ["Chia", "Soacha", "Zipaquira"] },
      { code: "VAC", name: "Valle del Cauca", cities: ["Cali", "Palmira", "Jamundi"] },
    ],
  },
  {
    code: "MX",
    name: "Mexico",
    phonePrefix: "+52",
    regionLabel: "State",
    regions: [
      { code: "CDMX", name: "Ciudad de Mexico", cities: ["Ciudad de Mexico"] },
      { code: "JAL", name: "Jalisco", cities: ["Guadalajara", "Zapopan", "Tlaquepaque"] },
      { code: "NLE", name: "Nuevo Leon", cities: ["Monterrey", "San Nicolas", "Guadalupe"] },
    ],
  },
  {
    code: "US",
    name: "United States",
    phonePrefix: "+1",
    regionLabel: "State",
    regions: [
      { code: "CA", name: "California", cities: ["Los Angeles", "San Diego", "San Francisco"] },
      { code: "FL", name: "Florida", cities: ["Miami", "Orlando", "Tampa"] },
      { code: "NY", name: "New York", cities: ["New York City", "Buffalo", "Albany"] },
    ],
  },
];

const DEFAULT_COUNTRY_CODE = "CO";

type AdministrativeContact = {
  id: string;
  firstName: string;
  middleName: string;
  firstSurname: string;
  secondSurname: string;
  email: string;
  phone: string;
  phoneExtension: string;
  position: string;
  organizationRoleName: string;
};

type OrganizationTemplateRole = {
  id: string;
  name: string;
};

type OrganizationTemplateResponse = {
  roles: OrganizationTemplateRole[];
  requiredRoleNames: string[];
  missingRoleNames: string[];
  ready: boolean;
};

type FormState = {
  name: string;
  description: string;
  appSubdomain: string;
  appBaseDomain: string;
  adminDomain: string;
  jitDefaultRoleName: string;
  business: {
    website: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    numberOfEmployees: string;
    industry: string;
    type: string;
    about: string;
    nit: string;
    verificationDigit: string;
  };
  segmentation: {
    tags: string[];
    lists: string[];
  };
  administrativeContacts: AdministrativeContact[];
};

type CreatedState = {
  organizationId: string;
  organizationName: string;
  organizationDescription: string | null;
  firstAdminUserId: string | null;
  assignedOrganizationRole: string | null;
  administrativeContactAssignments: Array<{
    key: string;
    email: string;
    logtoUserId: string;
    roleName: string;
    userCreated: boolean;
    userSource: string;
  }>;
};

const getCountryOption = (countryCode: string): GeographyCountry | null =>
  COUNTRY_OPTIONS.find((country) => country.code === countryCode) ?? null;

const getRegionOption = (countryCode: string, regionCode: string): GeographyRegion | null =>
  getCountryOption(countryCode)?.regions.find((region) => region.code === regionCode) ?? null;

const normalizePhoneValue = (value: string) => value.replace(/\s+/g, " ").trim();

const propagatePhonePrefix = (phone: string, previousPrefix: string | null, nextPrefix: string) => {
  const normalizedPhone = normalizePhoneValue(phone);
  if (!normalizedPhone) return nextPrefix;
  if (previousPrefix && normalizedPhone === previousPrefix) return nextPrefix;
  if (previousPrefix && normalizedPhone.startsWith(`${previousPrefix} `)) {
    return `${nextPrefix} ${normalizedPhone.slice(previousPrefix.length + 1)}`.trim();
  }
  if (previousPrefix && normalizedPhone.startsWith(previousPrefix)) {
    return `${nextPrefix}${normalizedPhone.slice(previousPrefix.length)}`.trim();
  }
  if (normalizedPhone.startsWith("+")) return normalizedPhone;
  return `${nextPrefix} ${normalizedPhone}`.trim();
};

const emptyContact = (
  index: number,
  roleName = "Admin-org",
  countryCode = DEFAULT_COUNTRY_CODE,
): AdministrativeContact => ({
  id: `contact-${index}`,
  firstName: "",
  middleName: "",
  firstSurname: "",
  secondSurname: "",
  email: "",
  phone: getCountryOption(countryCode)?.phonePrefix || "",
  phoneExtension: "",
  position: "",
  organizationRoleName: roleName,
});

const initialFormState = (defaultRoleName = "Admin-org"): FormState => ({
  name: "",
  description: "",
  appSubdomain: "",
  appBaseDomain: APP_BASE_DOMAINS[0],
  adminDomain: "",
  jitDefaultRoleName: "member",
  business: {
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: DEFAULT_COUNTRY_CODE,
    numberOfEmployees: "",
    industry: "",
    type: "",
    about: "",
    nit: "",
    verificationDigit: "",
  },
  segmentation: {
    tags: [],
    lists: [],
  },
  administrativeContacts: [emptyContact(1, defaultRoleName, DEFAULT_COUNTRY_CODE)],
});

const toSentence = (value: string) => value.trim();

const parseDelimitedValues = (value: string) =>
  Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const inputClassName =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const labelClassName = "block text-sm font-medium text-slate-700";
const sectionClassName = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

const OwnerOrganizationsPage = () => {
  const ownerApi = useOwnerApi();
  const [template, setTemplate] = useState<OrganizationTemplateResponse | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedState | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTemplate = async () => {
      setTemplateLoading(true);
      setTemplateError(null);
      try {
        const response = await ownerApi.getOrganizationTemplate();
        if (cancelled) return;
        setTemplate(response);
        setForm((current) => {
          const adminRole =
            response.roles.find((role) => role.name === "Admin-org")?.name ||
            response.roles[0]?.name ||
            "Admin-org";
          const jitRole =
            response.roles.find((role) => role.name === "member")?.name ||
            response.roles[0]?.name ||
            "member";
          return {
            ...current,
            jitDefaultRoleName: current.jitDefaultRoleName || jitRole,
            administrativeContacts: current.administrativeContacts.map((contact, index) => ({
              ...contact,
              organizationRoleName: contact.organizationRoleName || adminRole,
              phone:
                normalizePhoneValue(contact.phone) ||
                getCountryOption(current.business.country)?.phonePrefix ||
                getCountryOption(DEFAULT_COUNTRY_CODE)?.phonePrefix ||
                "",
              id: `contact-${index + 1}`,
            })),
          };
        });
      } catch (error) {
        if (cancelled) return;
        setTemplateError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setTemplateLoading(false);
      }
    };

    void loadTemplate();
    return () => {
      cancelled = true;
    };
  }, [ownerApi]);

  const adminRoleOptions = useMemo(() => template?.roles ?? [], [template]);
  const selectedCountry = useMemo(
    () => getCountryOption(form.business.country) ?? getCountryOption(DEFAULT_COUNTRY_CODE),
    [form.business.country],
  );
  const regionOptions: readonly GeographyRegion[] = selectedCountry?.regions ?? [];
  const selectedRegion = useMemo(
    () => getRegionOption(form.business.country, form.business.state),
    [form.business.country, form.business.state],
  );
  const cityOptions: readonly string[] = selectedRegion?.cities ?? [];
  const canSubmit = Boolean(template?.ready) && !submitting;

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateBusinessField = <K extends keyof FormState["business"]>(field: K, value: string) => {
    setForm((current) => ({
      ...current,
      business: {
        ...current.business,
        [field]: value,
      },
    }));
  };

  const updateCountryField = (countryCode: string) => {
    setForm((current) => {
      const previousCountry = getCountryOption(current.business.country);
      const nextCountry = getCountryOption(countryCode);

      if (!nextCountry) {
        return {
          ...current,
          business: {
            ...current.business,
            country: countryCode,
            state: "",
            city: "",
          },
        };
      }

      const stateIsStillValid = nextCountry.regions.some(
        (region) => region.code === current.business.state,
      );
      const nextState = stateIsStillValid ? current.business.state : "";
      const nextRegion = nextCountry.regions.find((region) => region.code === nextState) ?? null;
      const cityIsStillValid = nextRegion
        ? nextRegion.cities.includes(current.business.city)
        : false;
      const nextCity = cityIsStillValid ? current.business.city : "";

      return {
        ...current,
        business: {
          ...current.business,
          country: countryCode,
          state: nextState,
          city: nextCity,
        },
        administrativeContacts: current.administrativeContacts.map((contact) => ({
          ...contact,
          phone: propagatePhonePrefix(
            contact.phone,
            previousCountry?.phonePrefix ?? null,
            nextCountry.phonePrefix,
          ),
        })),
      };
    });
  };

  const updateStateField = (stateCode: string) => {
    setForm((current) => {
      const nextRegion = getRegionOption(current.business.country, stateCode);
      const cityIsStillValid = nextRegion
        ? nextRegion.cities.includes(current.business.city)
        : false;
      return {
        ...current,
        business: {
          ...current.business,
          state: stateCode,
          city: cityIsStillValid ? current.business.city : "",
        },
      };
    });
  };

  const updateContact = (id: string, field: keyof AdministrativeContact, value: string) => {
    setForm((current) => ({
      ...current,
      administrativeContacts: current.administrativeContacts.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact,
      ),
    }));
  };

  const addContact = () => {
    const fallbackRole =
      adminRoleOptions.find((role) => role.name === "Admin-org")?.name ||
      adminRoleOptions[0]?.name ||
      "Admin-org";
    setForm((current) => ({
      ...current,
      administrativeContacts: [
        ...current.administrativeContacts,
        emptyContact(current.administrativeContacts.length + 1, fallbackRole, current.business.country),
      ],
    }));
  };

  const removeContact = (id: string) => {
    setForm((current) => {
      const next = current.administrativeContacts.filter((contact) => contact.id !== id);
      return {
        ...current,
        administrativeContacts:
          next.length > 0 ? next : [emptyContact(1, "Admin-org", current.business.country)],
      };
    });
  };

  const validate = () => {
    const errors: string[] = [];
    if (!toSentence(form.name)) errors.push("Organization name is required.");
    if (!toSentence(form.appSubdomain)) errors.push("Application subdomain is required.");
    if (!toSentence(form.appBaseDomain)) errors.push("Application base domain is required.");
    if (!toSentence(form.adminDomain)) errors.push("Institutional provisioning domain is required.");

    const seenEmails = new Set<string>();
    form.administrativeContacts.forEach((contact, index) => {
      if (!toSentence(contact.firstName)) {
        errors.push(`Administrative contact ${index + 1}: first name is required.`);
      }
      if (!toSentence(contact.firstSurname)) {
        errors.push(`Administrative contact ${index + 1}: first surname is required.`);
      }
      if (!toSentence(contact.email)) {
        errors.push(`Administrative contact ${index + 1}: email is required.`);
      }
      if (!toSentence(contact.organizationRoleName)) {
        errors.push(`Administrative contact ${index + 1}: organization role is required.`);
      }
      const email = contact.email.trim().toLowerCase();
      if (email) {
        if (seenEmails.has(email)) {
          errors.push(`Administrative contact ${index + 1}: email ${email} is duplicated.`);
        }
        seenEmails.add(email);
      }
    });

    return errors;
  };

  const buildPayload = (): CreateOwnerOrganizationInput => {
    const primaryAdministrativeContact = form.administrativeContacts[0];
    const primaryOwnerName = [
      primaryAdministrativeContact?.firstName,
      primaryAdministrativeContact?.middleName,
      primaryAdministrativeContact?.firstSurname,
      primaryAdministrativeContact?.secondSurname,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      appSubdomain: form.appSubdomain.trim().toLowerCase(),
      appBaseDomain: form.appBaseDomain.trim().toLowerCase(),
      adminDomain: form.adminDomain.trim().toLowerCase(),
      jitProvisioning: {
        defaultRoleNames: [form.jitDefaultRoleName],
      },
      contact: {
        email: primaryAdministrativeContact?.email.trim().toLowerCase() || undefined,
        phone: primaryAdministrativeContact?.phone.trim() || undefined,
        owner: primaryOwnerName || undefined,
      },
      business: {
        website: form.business.website.trim() || undefined,
        addressLine1: form.business.addressLine1.trim() || undefined,
        addressLine2: form.business.addressLine2.trim() || undefined,
        city: form.business.city.trim() || undefined,
        state: selectedRegion?.name || undefined,
        postalCode: form.business.postalCode.trim() || undefined,
        country: selectedCountry?.name || undefined,
        numberOfEmployees: form.business.numberOfEmployees.trim() || undefined,
        industry: form.business.industry.trim() || undefined,
        type: form.business.type.trim() || undefined,
        about: form.business.about.trim() || undefined,
        nit: form.business.nit.trim() || undefined,
        verificationDigit: form.business.verificationDigit.trim() || undefined,
      },
      segmentation: {
        tags: form.segmentation.tags,
        lists: form.segmentation.lists,
      },
      administrativeContacts: form.administrativeContacts.map((contact) => ({
        key: contact.id,
        firstName: contact.firstName.trim(),
        middleName: contact.middleName.trim() || undefined,
        firstSurname: contact.firstSurname.trim(),
        secondSurname: contact.secondSurname.trim() || undefined,
        email: contact.email.trim().toLowerCase(),
        phone: contact.phone.trim() || undefined,
        phoneExtension: contact.phoneExtension.trim() || undefined,
        position: contact.position.trim() || undefined,
        organizationRoleName: contact.organizationRoleName,
      })),
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    const errors = validate();
    if (errors.length > 0) {
      setSubmitError(errors.join(" "));
      return;
    }

    setSubmitting(true);
    try {
      const response = await ownerApi.createOrganization(buildPayload());
      setCreated({
        organizationId: response.data.id,
        organizationName: response.data.name || form.name,
        organizationDescription: response.data.description || form.description || null,
        firstAdminUserId: response.bootstrap?.firstAdminUserId || null,
        assignedOrganizationRole: response.bootstrap?.assignedOrganizationRole || null,
        administrativeContactAssignments:
          response.bootstrap?.administrativeContactAssignments || [],
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-700">
              Provisioning workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Create organization</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Workspace enfocado en provisioning: template status, organización canónica, custom data, usuarios administrativos, segmentación y submit. La navegación primaria permanece en la barra superior.
            </p>
          </div>
        </div>

        {templateError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            Could not load the organization template from the API. {templateError}
          </div>
        )}

        {created && (
          <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="text-lg font-semibold text-emerald-900">Organization created in Logto</h2>
            <p className="mt-2 text-sm text-emerald-800">
              <strong>{created.organizationName}</strong> was created successfully and the administrative users were
              provisioned.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-white/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Bootstrap</div>
                <div className="mt-2 text-sm text-slate-700">
                  First admin user id: {created.firstAdminUserId || "-"}
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  Assigned organization role: {created.assignedOrganizationRole || "-"}
                </div>
              </div>
              <div className="rounded-xl bg-white/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Administrative assignments
                </div>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {created.administrativeContactAssignments.map((assignment) => (
                    <li key={`${assignment.email}-${assignment.logtoUserId}`}>
                      {assignment.email} · {assignment.roleName} · {assignment.userCreated ? "new user" : assignment.userSource}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className={sectionClassName}>
            <div className="mb-6 flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-slate-900">Canonical organization</h2>
              <p className="text-sm text-slate-600">
                The organization is created canonically in Logto. The fields below define its entry URL and
                institutional provisioning domain.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className={labelClassName}>Organization name</label>
                <input className={inputClassName} value={form.name} onChange={(event) => updateField("name", event.target.value)} />
              </div>
              <div>
                <label className={labelClassName}>Description</label>
                <input className={inputClassName} value={form.description} onChange={(event) => updateField("description", event.target.value)} />
              </div>
              <div>
                <label className={labelClassName}>Application subdomain</label>
                <input
                  className={inputClassName}
                  value={form.appSubdomain}
                  onChange={(event) => updateField("appSubdomain", event.target.value)}
                  placeholder="school-demo"
                />
              </div>
              <div>
                <label className={labelClassName}>Application base domain</label>
                <select className={inputClassName} value={form.appBaseDomain} onChange={(event) => updateField("appBaseDomain", event.target.value)}>
                  {APP_BASE_DOMAINS.map((domain) => (
                    <option value={domain} key={domain}>
                      {domain}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClassName}>Institutional provisioning domain</label>
                <input
                  className={inputClassName}
                  value={form.adminDomain}
                  onChange={(event) => updateField("adminDomain", event.target.value)}
                  placeholder="school.edu.co"
                />
              </div>
              <div>
                <label className={labelClassName}>JIT default role</label>
                <select
                  className={inputClassName}
                  value={form.jitDefaultRoleName}
                  onChange={(event) => updateField("jitDefaultRoleName", event.target.value)}
                  disabled={templateLoading || adminRoleOptions.length === 0}
                >
                  {adminRoleOptions.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Entry URL preview:{" "}
              <strong>
                {form.appSubdomain && form.appBaseDomain
                  ? `https://${form.appSubdomain}.${form.appBaseDomain}`
                  : "Pending subdomain and domain"}
              </strong>
            </div>
          </section>

          <section className={sectionClassName}>
            <div className="mb-6 flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-slate-900">Business profile and custom data</h2>
              <p className="text-sm text-slate-600">
                These fields populate the organization custom data that Civitas keeps attached to the canonical
                organization record.
              </p>
            </div>
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Country now drives both the phone prefix suggested for administrative contacts and the dependent
              region and city lists.
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className={labelClassName}>Website</label>
                <input className={inputClassName} value={form.business.website} onChange={(event) => updateBusinessField("website", event.target.value)} />
              </div>
              <div>
                <label className={labelClassName}>Country</label>
                <select className={inputClassName} value={form.business.country} onChange={(event) => updateCountryField(event.target.value)}>
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClassName}>{selectedCountry?.regionLabel || "State / region"}</label>
                <select className={inputClassName} value={form.business.state} onChange={(event) => updateStateField(event.target.value)}>
                  <option value="">Select {selectedCountry?.regionLabel?.toLowerCase() || "region"}</option>
                  {regionOptions.map((region) => (
                    <option key={region.code} value={region.code}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClassName}>City</label>
                <select className={inputClassName} value={form.business.city} onChange={(event) => updateBusinessField("city", event.target.value)} disabled={cityOptions.length === 0}>
                  <option value="">Select city</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClassName}>Postal code</label>
                <input className={inputClassName} value={form.business.postalCode} onChange={(event) => updateBusinessField("postalCode", event.target.value)} />
              </div>
              <div>
                <label className={labelClassName}>Number of employees</label>
                <input className={inputClassName} value={form.business.numberOfEmployees} onChange={(event) => updateBusinessField("numberOfEmployees", event.target.value)} />
              </div>
              <div>
                <label className={labelClassName}>Industry</label>
                <input className={inputClassName} value={form.business.industry} onChange={(event) => updateBusinessField("industry", event.target.value)} />
              </div>
              <div>
                <label className={labelClassName}>Organization type</label>
                <input className={inputClassName} value={form.business.type} onChange={(event) => updateBusinessField("type", event.target.value)} />
              </div>
              <div>
                <label className={labelClassName}>Tax id / NIT</label>
                <input className={inputClassName} value={form.business.nit} onChange={(event) => updateBusinessField("nit", event.target.value)} />
              </div>
              <div>
                <label className={labelClassName}>Verification digit</label>
                <input className={inputClassName} value={form.business.verificationDigit} onChange={(event) => updateBusinessField("verificationDigit", event.target.value)} />
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <label className={labelClassName}>Address line 1</label>
                <input className={inputClassName} value={form.business.addressLine1} onChange={(event) => updateBusinessField("addressLine1", event.target.value)} />
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <label className={labelClassName}>Address line 2</label>
                <input className={inputClassName} value={form.business.addressLine2} onChange={(event) => updateBusinessField("addressLine2", event.target.value)} />
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <label className={labelClassName}>About</label>
                <textarea className={inputClassName} rows={4} value={form.business.about} onChange={(event) => updateBusinessField("about", event.target.value)} />
              </div>
            </div>
          </section>

          <section className={sectionClassName}>
            <div className="mb-6 flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-slate-900">Administrative users</h2>
              <p className="text-sm text-slate-600">
                These users are provisioned or resolved in Logto, added to the new organization, and assigned their
                organization role.
              </p>
              <p className="text-sm text-slate-500">
                The first administrative contact seeds the organization contact email and phone, but every value
                remains editable after the suggestion is applied.
              </p>
            </div>
            <div className="space-y-5">
              {form.administrativeContacts.map((contact, index) => (
                <div key={contact.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Administrative contact {index + 1}</h3>
                      <p className="text-sm text-slate-500">
                        Users created here keep the custom data flow intact when sent to Logto.
                      </p>
                    </div>
                    {form.administrativeContacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContact(contact.id)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className={labelClassName}>First name</label>
                      <input className={inputClassName} value={contact.firstName} onChange={(event) => updateContact(contact.id, "firstName", event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClassName}>Middle name</label>
                      <input className={inputClassName} value={contact.middleName} onChange={(event) => updateContact(contact.id, "middleName", event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClassName}>First surname</label>
                      <input className={inputClassName} value={contact.firstSurname} onChange={(event) => updateContact(contact.id, "firstSurname", event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClassName}>Second surname</label>
                      <input className={inputClassName} value={contact.secondSurname} onChange={(event) => updateContact(contact.id, "secondSurname", event.target.value)} />
                    </div>
                    <div className="xl:col-span-2">
                      <label className={labelClassName}>Email</label>
                      <input className={inputClassName} type="email" value={contact.email} onChange={(event) => updateContact(contact.id, "email", event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClassName}>Phone</label>
                      <input className={inputClassName} value={contact.phone} onChange={(event) => updateContact(contact.id, "phone", event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClassName}>Extension</label>
                      <input className={inputClassName} value={contact.phoneExtension} onChange={(event) => updateContact(contact.id, "phoneExtension", event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClassName}>Position</label>
                      <input className={inputClassName} value={contact.position} onChange={(event) => updateContact(contact.id, "position", event.target.value)} />
                    </div>
                    <div className="xl:col-span-2">
                      <label className={labelClassName}>Organization role</label>
                      <select
                        className={inputClassName}
                        value={contact.organizationRoleName}
                        onChange={(event) => updateContact(contact.id, "organizationRoleName", event.target.value)}
                        disabled={templateLoading || adminRoleOptions.length === 0}
                      >
                        {adminRoleOptions.map((role) => (
                          <option key={`${contact.id}-${role.id}`} value={role.name}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addContact}
                className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              >
                Add another administrative user
              </button>
            </div>
          </section>

          <section className={sectionClassName}>
            <div className="mb-6 flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-slate-900">Segmentation metadata</h2>
              <p className="text-sm text-slate-600">
                These values are stored as clean segmentation metadata inside the organization custom data for later
                connector orchestration.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClassName}>Tags</label>
                <input
                  className={inputClassName}
                  value={form.segmentation.tags.join(", ")}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      segmentation: {
                        ...current.segmentation,
                        tags: parseDelimitedValues(event.target.value),
                      },
                    }))
                  }
                  placeholder="school, k12, premium"
                />
              </div>
              <div>
                <label className={labelClassName}>Lists</label>
                <input
                  className={inputClassName}
                  value={form.segmentation.lists.join(", ")}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      segmentation: {
                        ...current.segmentation,
                        lists: parseDelimitedValues(event.target.value),
                      },
                    }))
                  }
                  placeholder="north-region, onboarding"
                />
              </div>
            </div>
          </section>

          <section className={sectionClassName}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Submit provisioning</h2>
                <p className="mt-2 text-sm text-slate-600">
                  This action must keep the canonical flow intact: create the organization in Logto, provision the
                  administrative users, assign their organization roles, and save the custom data payload without
                  relying on the old owner shell.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Template status: <strong>{templateLoading ? "loading" : template?.ready ? "ready" : "not ready"}</strong>
                {!templateLoading && template && template.missingRoleNames.length > 0 && (
                  <div className="mt-2 text-red-600">Missing roles: {template.missingRoleNames.join(", ")}</div>
                )}
              </div>
            </div>
            {submitError && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button type="submit" disabled={!canSubmit} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {submitting ? "Creating organization..." : "Create organization"}
              </button>
            </div>
          </section>
        </form>
      </main>
    </div>
  );
};

export default OwnerOrganizationsPage;
