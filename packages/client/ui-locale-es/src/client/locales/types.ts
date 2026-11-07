/** Dictionary types shared by the Spanish namespace dictionaries. */
import type { LocaleDictOf, LocaleNamespaceMap } from '@worldapptechnologies/nulu-client-ui-slots'
// Type-only imports: each owner's client entry merges its namespaces into
// LocaleNamespaceMap, which types the Spanish dictionaries below.
import type {} from '@worldapptechnologies/nulu-client-locale/client'
import type {} from '@worldapptechnologies/nulu-client-ui-agent-preset/client'
import type {} from '@worldapptechnologies/nulu-client-ui-approval/client'
import type {} from '@worldapptechnologies/nulu-client-ui-chat/client'
import type {} from '@worldapptechnologies/nulu-client-ui-commands/client'
import type {} from '@worldapptechnologies/nulu-client-ui-conversation/client'
import type {} from '@worldapptechnologies/nulu-client-ui-cordis/client'
import type {} from '@worldapptechnologies/nulu-client-ui-deliverables/client'
import type {} from '@worldapptechnologies/nulu-client-ui-goal/client'
import type {} from '@worldapptechnologies/nulu-client-ui-input-trigger/client'
import type {} from '@worldapptechnologies/nulu-client-ui-jobs/client'
import type {} from '@worldapptechnologies/nulu-client-ui-message-feedback/client'
import type {} from '@worldapptechnologies/nulu-client-ui-model-selection/client'
import type {} from '@worldapptechnologies/nulu-client-ui-open-in-app/client'
import type {} from '@worldapptechnologies/nulu-client-ui-permission-presets/client'
import type {} from '@worldapptechnologies/nulu-client-ui-plan/client'
import type {} from '@worldapptechnologies/nulu-client-ui-reference/client'
import type {} from '@worldapptechnologies/nulu-client-ui-schedule/client'
import type {} from '@worldapptechnologies/nulu-client-ui-settings-general/client'
import type {} from '@worldapptechnologies/nulu-client-ui-settings-models/client'
import type {} from '@worldapptechnologies/nulu-client-ui-settings-plugin-inventory/client'
import type {} from '@worldapptechnologies/nulu-client-ui-settings-plugins/client'
import type {} from '@worldapptechnologies/nulu-client-ui-settings-unarchive-sessions/client'
import type {} from '@worldapptechnologies/nulu-client-ui-sidebar/client'
import type {} from '@worldapptechnologies/nulu-client-ui-sidebar-documentpreview/client'
import type {} from '@worldapptechnologies/nulu-client-ui-sidebar-files/client'
import type {} from '@worldapptechnologies/nulu-client-ui-sidebar-right/client'
import type {} from '@worldapptechnologies/nulu-client-ui-sidebar-terminal/client'
import type {} from '@worldapptechnologies/nulu-client-ui-skill/client'
import type {} from '@worldapptechnologies/nulu-client-ui-subagent/client'
import type {} from '@worldapptechnologies/nulu-client-ui-theme/client'
import type {} from '@worldapptechnologies/nulu-client-ui-trajectory/client'
import type {} from '@worldapptechnologies/nulu-client-ui-user-questions/client'
import type {} from '@worldapptechnologies/nulu-client-ui-workflow-run/client'
import type {} from '@worldapptechnologies/nulu-client-ui-workspace/client'
import type {} from '@worldapptechnologies/nulu-session-log-export/client'
// These owners' client entries use their dictionaries only as values, so the
// emitted entry declarations omit the merge; import the declaring modules.
import type {} from '@worldapptechnologies/nulu-client-ui-reference/src/client/locales.ts'
import type {} from '@worldapptechnologies/nulu-client-ui-sidebar-documentpreview/src/client/code/locales.ts'
import type {} from '@worldapptechnologies/nulu-client-ui-sidebar-documentpreview/src/client/html/locales.ts'
import type {} from '@worldapptechnologies/nulu-client-ui-sidebar-documentpreview/src/client/image/locales.ts'
import type {} from '@worldapptechnologies/nulu-client-ui-sidebar-documentpreview/src/client/markdown/locales.ts'
import type {} from '@worldapptechnologies/nulu-client-ui-sidebar-documentpreview/src/client/pdf/locales.ts'
import type {} from '@worldapptechnologies/nulu-client-ui-sidebar-terminal/src/client/locales.ts'

/** A namespace merged into LocaleNamespaceMap by one of the owners imported above. */
export type LocaleNamespace = Extract<keyof LocaleNamespaceMap, string>

/**
 * Spanish dictionary for a declared namespace. Any subset of the namespace's
 * keys is accepted, and a key the namespace no longer declares is a compile
 * error; an absent key resolves through the English fallback.
 */
export type SpanishDictionary<N extends LocaleNamespace> = Partial<LocaleDictOf<N>>

/**
 * Keys of the `directory-browser` namespace. Its owner,
 * `nulu-client-ui-directory-picker-browse`, registers that namespace untyped,
 * so the package spec compares this union with the registered English keys.
 */
export type DirectoryBrowserKey =
  | 'browser.title'
  | 'browser.home'
  | 'browser.newFolder'
  | 'browser.folderName'
  | 'browser.createIn'
  | 'browser.untitledFolder'
  | 'browser.create'
  | 'browser.cancel'
  | 'browser.open'
  | 'browser.editPath'
  | 'browser.loading'
  | 'browser.truncated'
  | 'browser.showHidden'
