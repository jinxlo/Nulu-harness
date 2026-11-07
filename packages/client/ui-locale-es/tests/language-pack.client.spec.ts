/**
 * Spanish language pack over a real LocaleRuntime: catalog entry, selection,
 * English fallback, fiber teardown, and agreement of every Spanish dictionary
 * with the English dictionary its owner registers.
 */
import { Context } from '@worldapptechnologies/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@worldapptechnologies/nulu-client-locale/client'
import { en as commonEn } from '@worldapptechnologies/nulu-client-locale/src/locales/en.ts'
import { en as settingsLocaleEn } from '@worldapptechnologies/nulu-client-locale/src/locales/settings.ts'
import { en as agentPresetEn } from '@worldapptechnologies/nulu-client-ui-agent-preset/src/client/locales.ts'
import { en as approvalEn } from '@worldapptechnologies/nulu-client-ui-approval/src/client/locales.ts'
import { en as chatEn } from '@worldapptechnologies/nulu-client-ui-chat/src/client/locale.ts'
import { en as commandEn } from '@worldapptechnologies/nulu-client-ui-commands/src/client/locales.ts'
import { en as conversationEn } from '@worldapptechnologies/nulu-client-ui-conversation/src/client/locales.ts'
import { en as cordisEn } from '@worldapptechnologies/nulu-client-ui-cordis/src/client/locales.ts'
import { en as deliverablesEn } from '@worldapptechnologies/nulu-client-ui-deliverables/src/client/locales.ts'
import { apply as applyDirectoryBrowser } from '@worldapptechnologies/nulu-client-ui-directory-picker-browse/src/client/index.ts'
import { en as goalEn } from '@worldapptechnologies/nulu-client-ui-goal/src/client/locales.ts'
import { en as slashMenuEn } from '@worldapptechnologies/nulu-client-ui-input-trigger/src/client/locales.ts'
import { en as jobEn } from '@worldapptechnologies/nulu-client-ui-jobs/src/client/locales.ts'
import { en as feedbackEn } from '@worldapptechnologies/nulu-client-ui-message-feedback/src/client/locales.ts'
import { en as modelEn } from '@worldapptechnologies/nulu-client-ui-model-selection/src/client/locales.ts'
import { en as openInAppEn } from '@worldapptechnologies/nulu-client-ui-open-in-app/src/client/locales.ts'
import {
  accessEn as permissionAccessEn, en as settingsPermissionEn,
} from '@worldapptechnologies/nulu-client-ui-permission-presets/src/client/locales.ts'
import { en as planEn } from '@worldapptechnologies/nulu-client-ui-plan/src/client/locales.ts'
import { en as referenceEn } from '@worldapptechnologies/nulu-client-ui-reference/src/client/locales.ts'
import { en as scheduleEn } from '@worldapptechnologies/nulu-client-ui-schedule/src/client/locales.ts'
import { en as settingsEn } from '@worldapptechnologies/nulu-client-ui-settings-general/src/client/locales.ts'
import { en as settingsModelsEn } from '@worldapptechnologies/nulu-client-ui-settings-models/src/client/locales.ts'
import { en as pluginInventoryEn } from '@worldapptechnologies/nulu-client-ui-settings-plugin-inventory/src/client/locales.ts'
import { en as settingsPluginsEn } from '@worldapptechnologies/nulu-client-ui-settings-plugins/src/client/locales.ts'
import { en as archivedSessionsEn } from '@worldapptechnologies/nulu-client-ui-settings-unarchive-sessions/src/client/locales.ts'
import { en as sidebarEn } from '@worldapptechnologies/nulu-client-ui-sidebar/src/client/locales.ts'
import { en as documentPreviewEn } from '@worldapptechnologies/nulu-client-ui-sidebar-documentpreview/src/client/locales.ts'
import { en as codePreviewEn } from '@worldapptechnologies/nulu-client-ui-sidebar-documentpreview/src/client/code/locales.ts'
import { en as htmlPreviewEn } from '@worldapptechnologies/nulu-client-ui-sidebar-documentpreview/src/client/html/locales.ts'
import { en as imagePreviewEn } from '@worldapptechnologies/nulu-client-ui-sidebar-documentpreview/src/client/image/locales.ts'
import { en as markdownPreviewEn } from '@worldapptechnologies/nulu-client-ui-sidebar-documentpreview/src/client/markdown/locales.ts'
import { en as pdfPreviewEn } from '@worldapptechnologies/nulu-client-ui-sidebar-documentpreview/src/client/pdf/locales.ts'
import { en as sidebarFilesEn } from '@worldapptechnologies/nulu-client-ui-sidebar-files/src/client/locales.ts'
import { en as sidebarRightEn } from '@worldapptechnologies/nulu-client-ui-sidebar-right/src/client/locales.ts'
import { en as sidebarTerminalEn } from '@worldapptechnologies/nulu-client-ui-sidebar-terminal/src/client/locales.ts'
import { en as skillEn } from '@worldapptechnologies/nulu-client-ui-skill/src/client/locales.ts'
import { en as subagentEn } from '@worldapptechnologies/nulu-client-ui-subagent/src/client/locales.ts'
import { en as themeEn } from '@worldapptechnologies/nulu-client-ui-theme/src/client/locales.ts'
import { en as trajectoryEn } from '@worldapptechnologies/nulu-client-ui-trajectory/src/client/locales.ts'
import { en as questionEn } from '@worldapptechnologies/nulu-client-ui-user-questions/src/client/locales.ts'
import { en as workflowRunEn } from '@worldapptechnologies/nulu-client-ui-workflow-run/src/client/locales.ts'
import { en as workspaceEn } from '@worldapptechnologies/nulu-client-ui-workspace/src/client/locales.ts'
import { en as sessionLogDownloadEn } from '@worldapptechnologies/nulu-session-log-export/src/client/locales.ts'
import { apply, inject } from '../src/client/index.ts'
import { dictionaries } from '../src/client/locales/index.ts'
import type { SpanishDictionary } from '../src/client/locales/types.ts'
import { apply as nodeApply } from '../src/index.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The English dictionary of the untyped `directory-browser` namespace, captured from its owner's registration. */
function directoryBrowserEn(): Record<string, string> {
  const captured = new Map<string, Record<string, string>>()
  const ctx = {
    effect: (body: () => unknown) => { body() },
    locale: {
      register: (_ns: string, locale: string, dict: Record<string, string>) => {
        captured.set(locale, dict)
        return () => {}
      },
      bind: () => (key: string) => key,
    },
    slots: { inject: () => () => {} },
  }
  applyDirectoryBrowser(ctx as never)
  const dict = captured.get('en')
  if (dict === undefined) throw new Error('directory-picker-browse registered no English dictionary')
  return dict
}

/** English dictionary per namespace, as each owner registers it. */
const ENGLISH: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'common': commonEn,
  'settings.locale': settingsLocaleEn,
  'settings': settingsEn,
  'settings.theme': themeEn,
  'settings.permission': settingsPermissionEn,
  'permission.access': permissionAccessEn,
  'settings.agentPreset': agentPresetEn,
  'settings.models': settingsModelsEn,
  'settings.plugins': settingsPluginsEn,
  'settings.pluginInventory': pluginInventoryEn,
  'settings.archivedSessions': archivedSessionsEn,
  'conversation': conversationEn,
  'chat': chatEn,
  'approval': approvalEn,
  'question': questionEn,
  'plan': planEn,
  'goal': goalEn,
  'command': commandEn,
  'slash.menu': slashMenuEn,
  'model': modelEn,
  'feedback': feedbackEn,
  'sidebar': sidebarEn,
  'workspace': workspaceEn,
  'sidebarRight': sidebarRightEn,
  'sidebarFiles': sidebarFilesEn,
  'sidebarTerminal': sidebarTerminalEn,
  'sidebarDocumentPreview': documentPreviewEn,
  'documentMarkdown': markdownPreviewEn,
  'sidebarCodePreview': codePreviewEn,
  'documentHtml': htmlPreviewEn,
  'sidebarImage': imagePreviewEn,
  'sidebarPdf': pdfPreviewEn,
  'directory-browser': directoryBrowserEn(),
  'reference': referenceEn,
  'open-in-app': openInAppEn,
  'subagent': subagentEn,
  'job': jobEn,
  'workflowRun': workflowRunEn,
  'deliverables': deliverablesEn,
  'skill': skillEn,
  'schedule.catalog': scheduleEn,
  'session-log-download': sessionLogDownloadEn,
  'cordis': cordisEn,
  'trajectory': trajectoryEn,
}

/** Placeholder names in a template, sorted. */
function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map(match => match[1]!).sort()
}

/** Boot the language pack over a real locale registry in an English browser. */
async function bench(): Promise<{ ctx: Context; locale: LocaleRuntime; fiber: ReturnType<Context['plugin']> }> {
  vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' })
  const ctx = new Context()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  for (const [namespace, dict] of Object.entries(ENGLISH)) locale.register(namespace, 'en', dict)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, locale, fiber }
}

describe('Spanish language pack', () => {
  it('keeps the host Loader entry inert and declares only the locale service', () => {
    expect(nodeApply).not.toThrow()
    expect(inject).toEqual(['locale'])
  })

  it('adds Español to the catalog with English as its fallback', async () => {
    const { locale } = await bench()
    expect(locale.getSnapshot().locales).toContainEqual({ id: 'es', label: 'Español', fallback: 'en' })
  })

  it('switches the UI copy to Spanish when selected', async () => {
    const { locale } = await bench()
    const t = locale.bind('settings.locale')
    expect(t('language.title')).toBe('Language')
    locale.setLocale('es')
    expect(locale.getSnapshot().active).toBe('es')
    expect(t('language.title')).toBe('Idioma')
    expect(locale.bind('workspace')('sessions.count.other', { n: 3 })).toBe('3 sesiones')
  })

  it('falls back to English for a key the Spanish dictionary omits', async () => {
    const { locale } = await bench()
    locale.setLocale('es')
    // Command tokens stay English so the composer can still resolve them.
    expect(locale.bind('command')('token.plan')).toBe('plan')
    expect(locale.bind('command')('label.plan')).toBe('Plan')
    locale.register('upstream-addition', 'en', { added: 'Added later' })
    expect(locale.bind('upstream-addition')('added')).toBe('Added later')
  })

  it('removes the language and every Spanish dictionary on fiber teardown (HMR safety)', async () => {
    const { locale, fiber } = await bench()
    locale.setLocale('es')
    await fiber.dispose()
    expect(locale.getSnapshot().locales.map(entry => entry.id)).not.toContain('es')
    expect(locale.getSnapshot().active).toBe('en')
    // A fresh registration of the same namespace and locale succeeds only if teardown released it.
    expect(() => locale.register('settings.locale', 'es', { 'language.title': 'Idioma' })).not.toThrow()
  })

  it('registers a dictionary for every namespace with an English dictionary', () => {
    expect(Object.keys(dictionaries).sort()).toEqual(Object.keys(ENGLISH).sort())
  })

  it('uses only keys that exist in English, keeps every placeholder, and leaves no value empty', () => {
    const problems: string[] = []
    for (const [namespace, spanish] of Object.entries(dictionaries)) {
      const english = ENGLISH[namespace]!
      for (const [key, value] of Object.entries(spanish as Record<string, string>)) {
        const source = english[key]
        if (source === undefined) {
          problems.push(`${namespace}: ${key} is not an English key`)
          continue
        }
        if (value.trim() === '') problems.push(`${namespace}: ${key} is empty`)
        if (placeholders(value).join() !== placeholders(source).join()) {
          problems.push(`${namespace}: ${key} placeholders ${placeholders(value).join()} differ from ${placeholders(source).join()}`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('rejects a key the namespace does not declare at compile time', () => {
    // @ts-expect-error -- 'chip.retired' is not a `plan` key; a stale Spanish key fails typecheck.
    const stale = { 'chip.retired': 'Retirado' } satisfies SpanishDictionary<'plan'>
    expect(Object.keys(stale)).toEqual(['chip.retired'])
  })
})
