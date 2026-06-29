function normalizeCrmCompanyInput(input = {}) { return { name: input.name || input.companyName || null, externalId: input.externalId || null, metadata: input.metadata || {} }; }
function buildFluentCrmCompanyPayload(input = {}) { const normalized = normalizeCrmCompanyInput(input); return { name: normalized.name, meta: normalized.metadata, external_id: normalized.externalId }; }
function computeCompanyFieldDiffs(current = {}, next = {}) { return Object.keys(next).filter((key) => JSON.stringify(current[key]) !== JSON.stringify(next[key])).map((field) => ({ field, from: current[field], to: next[field] })); }
module.exports = { buildFluentCrmCompanyPayload, computeCompanyFieldDiffs, normalizeCrmCompanyInput };
