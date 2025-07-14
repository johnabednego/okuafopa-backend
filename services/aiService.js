/**
 * Stub AI service for SprintSync.
 * Two modes:
 *  1) draftDescription: turn a short title into a fuller task description
 *  2) dailyPlan: given a list of today's tasks, return a concise plan
 *
 * If we later get an LLM key, we can swap in real calls here.
 */

async function draftDescription({ title }) {
  // deterministic stub
  return {
    title,
    description: `“${title}” is a key sprint task. Steps:\n` +
      `1. Break down the task into subtasks.\n` +
      `2. Discuss with team members.\n` +
      `3. Implement and test.\n` +
      `4. Review and merge.\n`,
  };
}

async function dailyPlan({ tasks }) {
  // tasks: array of {title, status}
  const lines = tasks.map((t, i) => `${i + 1}. [${t.status}] ${t.title}`);
  return {
    plan: `Here’s your plan for today:\n${lines.join('\n')}\n` +
          `Focus on completing the “In Progress” items first, then pick up a new “To Do”.\n`,
  };
}

// Main entry: selects mode or falls back
exports.getSuggestion = async ({ mode, payload }) => {
  switch (mode) {
    case 'draftDescription':
      return await draftDescription(payload);
    case 'dailyPlan':
      return await dailyPlan(payload);
    default:
      throw new Error(`Unknown AI mode: ${mode}`);
  }
};
