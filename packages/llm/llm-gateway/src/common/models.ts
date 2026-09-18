/** Default catalog shared by every Nulu protocol (World App Technologies models). */
import { DEFAULT_CONTEXT_WINDOW } from './defaults.ts'
import type { NuluCatalogModel } from './types.ts'

/** Advisory Nulu model entries; deployments may replace the catalog. */
export const DEFAULT_MODELS: NuluCatalogModel[] = [
  {
    id: 'nulu-5-ultra',
    name: 'Nulu 5 Ultra',
    description: 'Flagship multimodal model for advanced reasoning, code, agentic tasks, vision, and long-context work.',
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    inputModalities: ['text', 'image'],
    systemPromptUpdate: 'in-history',
  },
  {
    id: 'nulu-5-pro',
    name: 'Nulu 5 Pro',
    description: 'Deep reasoning model for complex analysis, technical planning, and code.',
    contextWindow: DEFAULT_CONTEXT_WINDOW,
  },
]
