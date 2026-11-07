/**
 * Spanish dictionaries keyed by namespace. Each entry is typed against its
 * owner's namespace keys; keys absent here resolve through English.
 */
import type { DirectoryBrowserKey, LocaleNamespace, SpanishDictionary } from './types.ts'
import {
  cordis, deliverables, job, scheduleCatalog, sessionLogDownload, skill, subagent, workflowRun,
} from './activity.ts'
import {
  approval, chat, command, conversation, feedback, goal, model, plan, question, slashMenu,
} from './conversation.ts'
import {
  permissionAccess, settings, settingsAgentPreset, settingsArchivedSessions, settingsModels,
  settingsPermission, settingsPluginInventory, settingsPlugins, settingsTheme,
} from './settings.ts'
import { common, settingsLocale } from './shell.ts'
import {
  directoryBrowser, documentHtml, documentMarkdown, openInApp, reference, sidebar, sidebarCodePreview,
  sidebarDocumentPreview, sidebarFiles, sidebarImage, sidebarPdf, sidebarRight, sidebarTerminal, workspace,
} from './sidebar.ts'
import { trajectory } from './trajectory.ts'

/** The selectable language: Spanish, labeled in Spanish, falling back to English. */
export const language = { id: 'es', label: 'Español', fallback: 'en' } as const

/** Spanish dictionaries for typed namespaces plus the untyped `directory-browser` namespace. */
export type SpanishDictionaries =
  & { readonly [N in LocaleNamespace]?: SpanishDictionary<N> }
  & { readonly 'directory-browser': Partial<Record<DirectoryBrowserKey, string>> }

/** Every Spanish dictionary this language pack registers. */
export const dictionaries = {
  'common': common,
  'settings.locale': settingsLocale,
  'settings': settings,
  'settings.theme': settingsTheme,
  'settings.permission': settingsPermission,
  'permission.access': permissionAccess,
  'settings.agentPreset': settingsAgentPreset,
  'settings.models': settingsModels,
  'settings.plugins': settingsPlugins,
  'settings.pluginInventory': settingsPluginInventory,
  'settings.archivedSessions': settingsArchivedSessions,
  'conversation': conversation,
  'chat': chat,
  'approval': approval,
  'question': question,
  'plan': plan,
  'goal': goal,
  'command': command,
  'slash.menu': slashMenu,
  'model': model,
  'feedback': feedback,
  'sidebar': sidebar,
  'workspace': workspace,
  'sidebarRight': sidebarRight,
  'sidebarFiles': sidebarFiles,
  'sidebarTerminal': sidebarTerminal,
  'sidebarDocumentPreview': sidebarDocumentPreview,
  'documentMarkdown': documentMarkdown,
  'sidebarCodePreview': sidebarCodePreview,
  'documentHtml': documentHtml,
  'sidebarImage': sidebarImage,
  'sidebarPdf': sidebarPdf,
  'directory-browser': directoryBrowser,
  'reference': reference,
  'open-in-app': openInApp,
  'subagent': subagent,
  'job': job,
  'workflowRun': workflowRun,
  'deliverables': deliverables,
  'skill': skill,
  'schedule.catalog': scheduleCatalog,
  'session-log-download': sessionLogDownload,
  'cordis': cordis,
  'trajectory': trajectory,
} satisfies SpanishDictionaries
