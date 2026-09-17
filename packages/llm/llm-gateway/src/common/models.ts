/** Default catalog shared by every Nulu protocol. */
import { DEFAULT_CONTEXT_WINDOW } from './defaults.ts'
import type { NuluCatalogModel } from './types.ts'

/** Advisory official model entries; deployments may replace the catalog. */
export const DEFAULT_MODELS: NuluCatalogModel[] = [
  {
    id: 'nulu-flash',
    name: 'Nulu-V41-Flash',
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    inputModalities: ['text', 'image'],
    systemPromptUpdate: 'in-history',
  },
  {
    id: 'nulu-v4-flash',
    name: 'Nulu-V4-Flash',
    description: 'Fast, efficient, and economical; suited to focused, routine, or parallel tasks.',
    contextWindow: DEFAULT_CONTEXT_WINDOW,
  },
  {
    id: 'nulu-v4-pro',
    name: 'Nulu-V4-Pro',
    description: 'Stronger agentic coding, knowledge, and difficult reasoning; suited to complex or quality-critical tasks at higher cost.',
    contextWindow: DEFAULT_CONTEXT_WINDOW,
  },
  {
    id: 'nulu-v4-flash-vision-exp',
    name: 'Nulu-V4-Flash-Vision-Exp',
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    inputModalities: ['text', 'image'],
  },
]
