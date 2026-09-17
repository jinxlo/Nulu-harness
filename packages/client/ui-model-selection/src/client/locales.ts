/**
 * `model` namespace dictionaries.
 *
 * `trigger.selectAria` intentionally matches `trigger.fallback` but remains a
 * separate key: the visible fallback label and the accessible name of
 * an unset trigger are free to diverge per locale, and folding it into
 * `trigger.aria` would announce the degenerate "Select model, current Select
 * model".
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'command.label': '模型',
  'command.description': '选择本会话使用的模型',
  'option.loadError': '目录加载失败：{message}',
  'option.nulu5Pro.description': '深度推理模型，适合复杂分析、技术规划与代码。',
  'option.nulu5Ultra.description': '更强的自主编码、知识与复杂推理能力；适合复杂或质量优先的任务，但成本更高。',
  'trigger.fallback': '选择模型',
  'trigger.loading': '正在加载模型…',
  'trigger.selectAria': '选择模型',
  'trigger.aria': '选择模型，当前 {model}',
  'trigger.ariaEffort': '选择模型，当前 {model}，推理等级 {effort}',
  'menu.aria': '模型与推理等级',
  'menu.model': '模型',
  'menu.effort': '推理等级',
  'effort.providerDefault': 'Default',
  'status.loading': '正在刷新模型列表…',
  'error.action': '模型操作失败：{message}',
  'action.reload': '重新加载',
  'warning.groupLoad': '{name} 加载失败：{message}',
  'empty.models': '没有可用的模型。',
  'blocked.composer': '当前模型不可用，请先选择模型',
  'empty.efforts': '当前模型未提供推理等级。',
} satisfies Record<string, string>

/** The model namespace key union. */
export type ModelKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'command.label': 'Model',
  'command.description': 'Select the model for this conversation',
  'option.loadError': 'Catalog failed to load: {message}',
  'option.nulu5Pro.description': 'Deep reasoning model for complex analysis, technical planning, and code.',
  'option.nulu5Ultra.description': 'Stronger agentic coding, knowledge, and difficult reasoning; suited to complex or quality-critical tasks at higher cost.',
  'trigger.fallback': 'Select model',
  'trigger.loading': 'Loading models…',
  'trigger.selectAria': 'Select model',
  'trigger.aria': 'Select model, current {model}',
  'trigger.ariaEffort': 'Select model, current {model}, reasoning effort {effort}',
  'menu.aria': 'Model and reasoning effort',
  'menu.model': 'Model',
  'menu.effort': 'Effort',
  'effort.providerDefault': 'Default',
  'status.loading': 'Refreshing model list…',
  'error.action': 'Model operation failed: {message}',
  'action.reload': 'Reload',
  'warning.groupLoad': '{name} failed to load: {message}',
  'empty.models': 'No models available.',
  'blocked.composer': 'This model is unavailable — select one to continue',
  'empty.efforts': 'This model provides no reasoning effort levels.',
} satisfies Record<ModelKey, string>
