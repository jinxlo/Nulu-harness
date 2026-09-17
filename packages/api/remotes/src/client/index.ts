/** Platform-neutral assembly of generated Host Remote contributions. */

import type { Context } from '@worldapptechnologies/cordis'
import agentPresetsRemote from '@worldapptechnologies/nulu-agent-presets/remote'
import commandsRemote from '@worldapptechnologies/nulu-commands/remote'
import settingsControllerRemote from '@worldapptechnologies/nulu-api-settings-controller/remote'
import goalsRemote from '@worldapptechnologies/nulu-goal/remote'
import llmRemote from '@worldapptechnologies/nulu-llm/remote'
import dynamicRemote from '@worldapptechnologies/nulu-cordis-host-runner/remote'
import pluginInventoryRemote from '@worldapptechnologies/nulu-host-plugin-inventory/remote'
import messageFeedbackRemote from '@worldapptechnologies/nulu-message-feedback/remote'
import permissionPresetsRemote from '@worldapptechnologies/nulu-permission-presets/remote'
import sessionFeedbackRemote from '@worldapptechnologies/nulu-command-feedback/remote'
import fileUploadsRemote from '@worldapptechnologies/nulu-client-file-upload/remote'
import sessionReferencesRemote from '@worldapptechnologies/nulu-session-reference/remote'
import subagentsRemote from '@worldapptechnologies/nulu-subagent/remote'
import sessionRemote from '@worldapptechnologies/nulu-api-session-controller/remote'
import workspaceRemote from '@worldapptechnologies/nulu-api-workspace-controller/remote'
import terminalRemote from '@worldapptechnologies/nulu-api-terminal-controller/remote'
import workspaceFilesRemote from '@worldapptechnologies/nulu-api-workspace-files/remote'
import type { ClientRemote } from '@worldapptechnologies/nulu-api-gateway/client'

export type { ClientRemote } from '@worldapptechnologies/nulu-api-gateway/client'
export type { PluginInventorySnapshot } from '@worldapptechnologies/nulu-host-plugin-inventory/types'
export type {} from '@worldapptechnologies/nulu-agent-presets/remote'
export type {} from '@worldapptechnologies/nulu-commands/remote'
export type {} from '@worldapptechnologies/nulu-api-settings-controller/remote'
export type {} from '@worldapptechnologies/nulu-goal/remote'
export type {} from '@worldapptechnologies/nulu-llm/remote'
export type {} from '@worldapptechnologies/nulu-host-plugin-inventory/remote'
export type {} from '@worldapptechnologies/nulu-message-feedback/remote'
export type {} from '@worldapptechnologies/nulu-permission-presets/remote'
export type {} from '@worldapptechnologies/nulu-command-feedback/remote'
export type {} from '@worldapptechnologies/nulu-client-file-upload/remote'
export type {} from '@worldapptechnologies/nulu-session-reference/remote'
export type {} from '@worldapptechnologies/nulu-subagent/remote'
export type * from '@worldapptechnologies/nulu-subagent/client'
export type {} from '@worldapptechnologies/nulu-api-session-controller/remote'
export type * from '@worldapptechnologies/nulu-api-session-controller/types'
export type {} from '@worldapptechnologies/nulu-api-workspace-controller/remote'
export type * from '@worldapptechnologies/nulu-api-workspace-controller/types'
export type {} from '@worldapptechnologies/nulu-api-workspace-files/remote'
export type * from '@worldapptechnologies/nulu-api-workspace-files/types'
export type {} from '@worldapptechnologies/nulu-api-terminal-controller/remote'
export type * from '@worldapptechnologies/nulu-api-terminal-controller/types'
export type { SessionJob as JobView } from '@worldapptechnologies/nulu-api-session-controller/types'
// The forwarded-event allowlist's selection seat: without it in the consumer's
// compilation face `TypertRemoteEvent` is `never` and every `$on` call fails.
export type { ApiRemoteForwardedEvent } from '../types.ts'
// The owner packages' client-safe `./types` exports supply the `Events`
// signatures `$on` hands to a listener, so a consumer reads the very
// declaration the Host emits rather than a flattened restatement of it.
export type {} from '@worldapptechnologies/nulu-commands/types'
export type {} from '@worldapptechnologies/nulu-cordis-host-runner/types'
export type {} from '@worldapptechnologies/nulu-credentials/types'
export type {} from '@worldapptechnologies/nulu-llm/types'
export type {} from '@worldapptechnologies/nulu-agent-presets/types'
export type {} from '@worldapptechnologies/nulu-permission-presets/types'
export type {} from '@worldapptechnologies/nulu-settings/types'
export type {} from '@worldapptechnologies/nulu-user-approval/types'
export type {} from '@worldapptechnologies/nulu-user-questions/types'
export type {} from '@worldapptechnologies/nulu-api-session-controller/types'

/**
 * The carrier's Client-facing types, re-exported so a business package names one
 * assembly package instead of both this facade and the Connection plugin. Type-only:
 * the carrier's runtime values stay behind their own module edge.
 */
export type {
  ConnectionHandle, ConnectionSinks, ContentBlock,
  MessageId,
  RpcId, RpcRequest, RpcResponse, RpcResult, SessionId,
  StreamChunk,
} from '@worldapptechnologies/nulu-client-connection/client'
export type {} from '@worldapptechnologies/nulu-api-gateway/client'
export type {} from '@worldapptechnologies/nulu-cordis-host-runner/remote'

// The payload vocabulary of the selected namespaces, re-exported so a Client
// contribution can name what it sends and receives without importing a Host
// package: this assembly is the one place both planes legitimately meet.
export type {
  ApprovalRequestId,
  CordisHalfState,
  CordisDynamicPackageId,
  CordisDynamicPluginId,
  CordisDynamicPluginRunId,
  CordisDynamicRunMode,
  CordisInspectMethodManifest,
  CordisInspectPlatform,
  CordisInspectProviderManifest,
  CordisInspectProviderView,
  CordisInspectQueryRequest,
  CordisInspectQueryResolution,
  CordisInspectQueryResolved,
  CordisInspectRequestId,
  CordisInspectResolveAck,
  CordisRunDiagnostic,
  CordisRunStatus,
  DynamicCordisClientSource,
  DynamicCordisHostHalfResult,
  DynamicCordisInventoryRow,
  DynamicCordisInvokeResult,
  DynamicCordisPackage,
  DynamicCordisRequestResolved,
  DynamicCordisResolveAck,
  DynamicCordisRetracted,
  DynamicCordisRunRequest,
  DynamicCordisRunResolution,
  DynamicCordisRunAttempt,
  DynamicCordisRunResponse,
  DynamicCordisStopResponse,
  DynamicCordisUndefineReceipt,
  RequestRunOutcome,
} from '@worldapptechnologies/nulu-cordis-host-runner/types'
// Credential state vocabulary for the credentials namespace (values never ride it).
export type { CredentialInfo } from '@worldapptechnologies/nulu-credentials/types'
// Redacted namespace vocabulary for the settings namespace (secrets never ride
// it). It travels with its seam, whose `./types` the Client face already reads.
export type {
  SettingsDescribeValue, SettingsNamespaceView, SettingsPathOpView, SettingsSecretView,
} from '@worldapptechnologies/nulu-settings/types'
// Provider registry and discovery vocabulary for the llm namespace.
export type {
  LlmConfigurableProvider, LlmDiscoveredModel,
  LlmModelDiscoveryRequest, LlmProviderInfo,
} from '@worldapptechnologies/nulu-llm/types'
// Reference-discovery result vocabulary for the fileReferences and
// sessionReferenceResolver namespaces.
export type { FileReferenceCandidate } from '@worldapptechnologies/nulu-file-reference/types'
export type { SessionReferenceMentionCandidate } from '@worldapptechnologies/nulu-session-reference/types'

// The Remote failure vocabulary, re-exported so business packages keep naming
// this assembly alone. Types only: a value export would make spec imports load
// this module's owner /remote artifacts; specs take RemoteError from
// nulu-client-test-runtime instead.
export type {
  RemoteErrorCode, RemoteErrorDetailsMap, RemoteFailure, RemoteResult,
} from '@worldapptechnologies/nulu-typert-protocol'
export type { RemoteHostFacts } from '@worldapptechnologies/nulu-api-gateway/client'

declare module '@worldapptechnologies/cordis' {
  interface Context {
    /** Generated Remote namespaces selected by this Client assembly. */
    remote: ClientRemote
  }
}

/** Required service: the typed Client Remote contribution mount. */
export const inject = ['remote']

/**
 * Mount the Host capabilities explicitly selected for this Client assembly.
 * @param ctx - Client Cordis root carrying the typed API service.
 * @returns disposer after every selected Remote namespace is ready.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const disposers: Array<() => Promise<void>> = []
  try {
    for (const contribution of [
      agentPresetsRemote, commandsRemote, settingsControllerRemote, goalsRemote, llmRemote, dynamicRemote,
      pluginInventoryRemote, messageFeedbackRemote, sessionFeedbackRemote, fileUploadsRemote, sessionReferencesRemote,
      permissionPresetsRemote, subagentsRemote, sessionRemote, workspaceRemote, workspaceFilesRemote, terminalRemote,
    ]) {
      disposers.push(await ctx.remote.$mount(contribution))
    }
  } catch (error) {
    for (const dispose of disposers.reverse()) await dispose()
    throw error
  }
  // Unwound in reverse mount order, so a namespace never outlives one mounted
  // after it.
  return async () => {
    for (const dispose of disposers.reverse()) await dispose()
  }
}
