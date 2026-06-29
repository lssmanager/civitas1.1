const { OPERATION_STATUSES } = require("../contracts/foundation");
const { validateActionDefinition } = require("./actionDefinition");
const { InMemoryFoundationStore } = require("./foundationStore");

class ActionPreconditionError extends Error {
  constructor(reason, humanFallback = null) {
    super(reason || "Action precondition failed");
    this.name = "ActionPreconditionError";
    this.humanFallback = humanFallback;
    this.retryable = false;
  }
}

function isRetryableError(error, retryPolicy = {}) {
  const retryableErrors = retryPolicy.retryable_errors || [];
  return Boolean(error?.retryable) || retryableErrors.includes(error?.name) || retryableErrors.includes(error?.code);
}

async function executeAction(actionDefinition, input, orgId, options = {}) {
  const action = validateActionDefinition(actionDefinition);
  const store = options.store || new InMemoryFoundationStore();
  const connectors = options.connectors;
  const db = options.db || store;
  const validInput = action.inputSchema.parse(input);
  const idempotencyKey = action.idempotencyKey(validInput);
  const existing = await store.getIdempotencyRecord(idempotencyKey);

  if (existing?.status === OPERATION_STATUSES.SUCCESS) {
    return existing.result;
  }

  const operation = await store.createOperation({
    orgId,
    actionType: action.action_type,
    input: validInput,
    idempotencyKey,
    maxAttempts: action.retryPolicy.max_attempts,
  });

  const step = await store.createStep({
    operationId: operation.id,
    stepName: action.action_type,
    input: validInput,
  });

  try {
    const precondition = await action.precondition(validInput, db);
    if (!precondition?.ok) {
      throw new ActionPreconditionError(precondition?.reason, action.humanFallback || null);
    }

    await store.updateOperation(operation.id, { status: OPERATION_STATUSES.PROCESSING });
    const result = await action.run(validInput, connectors, db);

    await store.updateStep(step.id, {
      status: "success",
      output: result,
      completed_at: new Date().toISOString(),
    });
    await store.updateOperation(operation.id, {
      status: OPERATION_STATUSES.SUCCESS,
      output: result,
      completed_at: new Date().toISOString(),
    });
    await store.saveIdempotencyRecord({
      idempotencyKey,
      operationType: action.action_type,
      scope: orgId,
      status: OPERATION_STATUSES.SUCCESS,
      result,
    });

    return result;
  } catch (error) {
    const retryable = isRetryableError(error, action.retryPolicy);
    const failedStatus = retryable && operation.attempt < action.retryPolicy.max_attempts
      ? OPERATION_STATUSES.PENDING
      : OPERATION_STATUSES.FAILED;

    await store.updateStep(step.id, {
      status: "failed",
      error: error.message,
      completed_at: new Date().toISOString(),
    });
    await store.updateOperation(operation.id, {
      status: failedStatus,
      error: error.message,
      next_retry_at: retryable ? new Date(Date.now() + Number(action.retryPolicy.backoff_ms || 1000)).toISOString() : null,
      completed_at: failedStatus === OPERATION_STATUSES.FAILED ? new Date().toISOString() : null,
    });

    throw error;
  }
}

module.exports = {
  ActionPreconditionError,
  executeAction,
  isRetryableError,
};
