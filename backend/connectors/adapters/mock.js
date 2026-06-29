const { MockBaseAdapter, registerAdapter } = require("../registry");

class MockLMSAdapter extends MockBaseAdapter {
  async enrollUser(input) {
    return { enrolled: true, input };
  }

  async unenrollUser(input) {
    return { unenrolled: true, input };
  }

  async getCourses() {
    return [];
  }

  async createCohort(input) {
    return { id: "mock-cohort", ...input };
  }
}

class MockCRMAdapter extends MockBaseAdapter {
  async createCompany(input) {
    return { id: "mock-company", ...input };
  }

  async getCompany(input) {
    return { id: input.company_id, name: "Mock company" };
  }

  async createContact(input) {
    return { id: `mock-contact:${input.email}`, ...input };
  }

  async tagContact(input) {
    return { tagged: true, ...input };
  }
}

function registerMockAdapters() {
  registerAdapter("lms", "mock", (config, metadata) => new MockLMSAdapter(config, metadata));
  registerAdapter("crm", "mock", (config, metadata) => new MockCRMAdapter(config, metadata));
}

module.exports = {
  MockCRMAdapter,
  MockLMSAdapter,
  registerMockAdapters,
};
