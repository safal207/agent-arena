export const DEFAULT_DECISION_TIMEOUT_MS = 4000;

export function parseDecisionTimeout(value) {
  if (value === undefined) return DEFAULT_DECISION_TIMEOUT_MS;
  const timeoutMs = Number(value);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 29000) {
    throw new Error('BOT_DECISION_TIMEOUT_MS must be an integer from 500 to 29000');
  }
  return timeoutMs;
}

export class DecisionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DecisionError';
    this.code = code;
  }
}

export async function decideWithinDeadline(selector, job, timeoutMs) {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 29000) {
    throw new Error('Decision deadline must be a positive integer no greater than 29000');
  }
  if (!Array.isArray(job.actions) || job.actions.length === 0) {
    throw new DecisionError('INVALID_ACTIONS', 'Server returned no allowed actions');
  }

  const controller = new AbortController();
  const startedAt = performance.now();
  const timeoutError = new DecisionError('DECISION_TIMEOUT', 'Decision deadline exceeded');
  const expire = () => {
    controller.abort(timeoutError);
    return timeoutError;
  };
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(expire()), timeoutMs);
  });
  const decision = Promise.resolve()
    .then(() => selector(job, { signal: controller.signal }))
    .then((action) => {
      if (performance.now() - startedAt >= timeoutMs) throw expire();
      if (!job.actions.includes(action)) {
        throw new DecisionError('INVALID_ACTION', 'Selector returned an action outside the allowed list');
      }
      return action;
    }, () => {
      // Provider errors can contain credentials or response bodies. Do not echo them.
      throw new DecisionError('DECISION_FAILED', 'Selector failed');
    });
  try {
    return await Promise.race([decision, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export function createTurnResponder(selector, submitAction, { timeoutMs = DEFAULT_DECISION_TIMEOUT_MS } = {}) {
  let submittedTurn = '';
  return async (job) => {
    const turnKey = `${job.matchId}:${job.turn}`;
    if (turnKey === submittedTurn) return null;
    // Claim this turn before selection: timed-out and invalid decisions are not retried.
    submittedTurn = turnKey;
    const action = await decideWithinDeadline(selector, job, timeoutMs);
    await submitAction(job, action);
    return { turnKey, action };
  };
}
