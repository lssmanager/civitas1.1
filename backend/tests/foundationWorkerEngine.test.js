const test = require("node:test");
const assert = require("node:assert/strict");

const { ACTION_QUEUES } = require("../contracts/foundation");
const { createPassthroughSchema } = require("../worker/actionDefinition");
const { executeAction } = require("../worker/engine");
const { InMemoryFoundationStore } = require("../worker/foundationStore");

const createMockEnrollAction = () => ({
  action_type: "lms.enroll_user",
  queue: ACTION_QUEUES.PRIORITY_COMMANDS,
  inputSchema: createPassthroughSchema((input) => Boolean(input?.user_email && input?.course_id)),
  precondition: async () => ({ ok: true }),
  run: async (input) => ({ enrolled: true, user_email: input.user_email, course_id: input.course_id }),
  retryPolicy: {
    max_attempts: 3,
    backoff: "exponential",
    backoff_ms: 100,
    retryable_errors: ["TemporaryProviderError"],
  },
  idempotencyKey: (input) => `lms.enroll_user:org-uuid:${input.user_email}:${input.course_id}`,
});

test("engine executes an action, records success and saves idempotency", async () => {
  const store = new InMemoryFoundationStore();
  const action = createMockEnrollAction();
  const input = { user_email: "student@example.com", course_id: "course-42" };

  const result = await executeAction(action, input, "org-uuid", { store });

  assert.deepEqual(result, { enrolled: true, user_email: "student@example.com", course_id: "course-42" });
  assert.equal(store.operations.length, 1);
  assert.equal(store.operations[0].status, "success");
  assert.equal(store.idempotencyRecords.size, 1);
  assert.equal([...store.idempotencyRecords.values()][0].status, "success");
});

test("engine returns cached result on second execution with the same idempotency key", async () => {
  const store = new InMemoryFoundationStore();
  const action = createMockEnrollAction();
  const input = { user_email: "student@example.com", course_id: "course-42" };
  const key = action.idempotencyKey(input);

  const first = await executeAction(action, input, "org-uuid", { store });
  const second = await executeAction(action, input, "org-uuid", { store });

  assert.deepEqual(first, second);
  assert.equal(store.countOperationsByIdempotencyKey(key), 1);
});
