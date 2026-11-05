/** Chat Completions response shared by SDK transport fixtures. */

/** A completed text turn with provider usage. */
export const CHAT_RESPONSE = [
  { choices: [{ index: 0, delta: { role: 'assistant', content: 'done' }, finish_reason: null }] },
  { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 } },
].map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n'
