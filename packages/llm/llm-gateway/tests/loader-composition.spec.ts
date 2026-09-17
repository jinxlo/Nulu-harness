/**
 * Real-composition guard for the dynamic-configuration chain: LlmRuntime,
 * settings-file, credentials-local, and llm-gateway boot from a test-only
 * cordis.yml through the actual Loader + Include path, external edits of
 * settings.yaml and the credentials document hot-publish through their providers, and the very
 * next request carries the fresh base URL and credential. The same adapter
 * composition without settings or credentials entries keeps entry-config
 * behavior — the documented optional-inject fallback.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@worldapptechnologies/cordis'
import Loader from '@worldapptechnologies/cordis-plugin-loader'
import Include from '@worldapptechnologies/cordis-plugin-include'
import LlmRuntime from '@worldapptechnologies/nulu-llm'
import AgentRegistry from '@worldapptechnologies/nulu-agent'
import SessionStore, { SessionId } from '@worldapptechnologies/nulu-session'
import { credentialRef } from '@worldapptechnologies/nulu-credentials'
import LocalCredentialProvider from '@worldapptechnologies/nulu-credentials-local'
import FileSettingsProvider from '@worldapptechnologies/nulu-settings-file'
import { getOrCreateAnonymousUserId } from '@worldapptechnologies/nulu-anonymous-user-id'
import NuluLlmApiExtensionRegistry from '@worldapptechnologies/nulu-llm-api-extensions'
import * as SessionLogGateway from '@worldapptechnologies/nulu-session-log-gateway'
import * as NuluPluginPackageInventory from '@worldapptechnologies/nulu-plugin-package-inventory'
import * as LlmGateway from '@worldapptechnologies/nulu-llm-gateway'
import { assemble } from './assemble.ts'
import { closeMockServers, mockServer, textEvents } from './mock-server.ts'
import { server as messagesServer } from './messages/helpers.ts'

const NS = 'llm-gateway'
const KEY_REF = credentialRef('WORLD_APP_TECHNOLOGIES_API_KEY')

let root: string | undefined
let context: Context | undefined
const closeMessagesServers: (() => Promise<void>)[] = []

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  await closeMockServers()
  while (closeMessagesServers.length) await closeMessagesServers.pop()!()
  vi.unstubAllEnvs()
})

async function loadComposition(
  options: { withDynamic: boolean; baseURL: string; reuseRoot?: string; enableSessionLog?: boolean; protocol?: 'chat-completions' | 'messages' },
): Promise<{ ctx: Context; settingsPath: string; credentialsPath: string }> {
  // A reused root is the restart case: the same harness home, its documents
  // exactly as the previous process left them.
  const fresh = options.reuseRoot === undefined
  root = options.reuseRoot ?? await mkdtemp(join(tmpdir(), 'nulu-llm-composition-'))
  vi.stubEnv('NULU_HOME', root)
  const settingsPath = join(root, 'settings.yaml')
  const credentialsPath = join(root, '.credentials.yaml')
  if (options.withDynamic && fresh) {
    await writeFile(settingsPath, '# personal settings\n')
    await writeFile(credentialsPath, 'version: 1\nrefs:\n  WORLD_APP_TECHNOLOGIES_API_KEY: boot-key\n', { mode: 0o600 })
  }

  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    '- id: llm',
    "  name: '@worldapptechnologies/nulu-llm'",
    '- id: session',
    "  name: '@worldapptechnologies/nulu-session'",
    '- id: agents',
    "  name: '@worldapptechnologies/nulu-agent'",
    '- id: deepseek-llm-api-extensions',
    "  name: '@worldapptechnologies/nulu-llm-api-extensions'",
    '- id: session-log-deepseek',
    "  name: '@worldapptechnologies/nulu-session-log-deepseek'",
    ...options.enableSessionLog !== undefined
      ? ['  config:', `    enabled: ${String(options.enableSessionLog)}`]
      : [],
    '- id: plugin-package-inventory',
    "  name: '@worldapptechnologies/nulu-plugin-package-inventory'",
    ...options.withDynamic
      ? [
        '- id: settings',
        "  name: '@worldapptechnologies/nulu-settings-file'",
        '  config:',
        `    path: ${JSON.stringify(settingsPath)}`,
        '    debounceMs: 10',
        '- id: credentials',
        "  name: '@worldapptechnologies/nulu-credentials-local'",
        '  config:',
        `    path: ${JSON.stringify(credentialsPath)}`,
        '    debounceMs: 10',
      ]
      : [],
    '- id: llm-gateway',
    "  name: '@worldapptechnologies/nulu-llm-gateway'",
    '  config:',
    `    protocol: ${options.protocol ?? 'chat-completions'}`,
    `    baseURL: ${JSON.stringify(options.baseURL)}`,
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@worldapptechnologies/nulu-llm', LlmRuntime],
    ['@worldapptechnologies/nulu-session', SessionStore],
    ['@worldapptechnologies/nulu-agent', AgentRegistry],
    ['@worldapptechnologies/nulu-llm-api-extensions', NuluLlmApiExtensionRegistry],
    ['@worldapptechnologies/nulu-session-log-gateway', SessionLogGateway],
    ['@worldapptechnologies/nulu-plugin-package-inventory', NuluPluginPackageInventory],
    ['@worldapptechnologies/nulu-settings-file', FileSettingsProvider],
    ['@worldapptechnologies/nulu-credentials-local', LocalCredentialProvider],
    ['@worldapptechnologies/nulu-llm-gateway', LlmGateway],
  ])
  // The custom importer bypasses Node resolution; mirror the package manifests
  // a deployed cordis.yml has beside its declared dependencies.
  await Promise.all([...modules.keys()].map(async (packageName) => {
    const packageDir = join(root!, 'node_modules', ...packageName.split('/'))
    await mkdir(packageDir, { recursive: true })
    await writeFile(join(packageDir, 'package.json'), `${JSON.stringify({
      name: packageName,
      version: '0.1.0-rc.8',
      type: 'module',
    })}\n`)
  }))
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()
  return { ctx, settingsPath, credentialsPath }
}

async function extensionServer(protocol: 'chat-completions' | 'messages') {
  if (protocol === 'chat-completions') return mockServer([{ kind: 'sse', events: textEvents }])
  const server = await messagesServer()
  closeMessagesServers.push(() => server.close())
  return { url: server.url, get requests() { return server.requests.map(request => request.body) } }
}

describe('llm-deepseek real dynamic composition', () => {
  it.each(['chat-completions', 'messages'] as const)('keeps package inventory on when the %s Loader composition disables session upload', async (protocol) => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'entry-key')
    const server = await extensionServer(protocol)
    const { ctx } = await loadComposition({ withDynamic: false, baseURL: server.url, protocol, enableSessionLog: false })
    const session = ctx.sessions.create(SessionId('extension-composition'))
    session.append('turn/start', { turn: 1 })

    await assemble(ctx, { model: 'nulu-5', messages: [], sessionId: session.id })
    const request = server.requests[0] as { nulu_plugin_packages: { version: number; packages: unknown[] } }
    expect(request).not.toHaveProperty('nulu_session_log')
    expect(request.nulu_plugin_packages.packages).toEqual(expect.arrayContaining([
      { name: '@worldapptechnologies/nulu-llm-api-extensions', version: '0.1.0-rc.8' },
      { name: '@worldapptechnologies/nulu-llm-gateway', version: '0.1.0-rc.8' },
      { name: '@worldapptechnologies/nulu-session-log-gateway', version: '0.1.0-rc.8' },
    ]))
    expect(request.nulu_plugin_packages.version).toBe(1)
    expect(SessionLogGateway.acceptedThrough(session)).toBe(-1)
  })

  it.each(['chat-completions', 'messages'] as const)('sends the canonical session suffix by default through %s Loader composition', async (protocol) => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'entry-key')
    const server = await extensionServer(protocol)
    const { ctx } = await loadComposition({
      withDynamic: false,
      baseURL: server.url,
      protocol,
    })
    const session = ctx.sessions.create(SessionId('extension-composition-enabled'))
    session.append('turn/start', { turn: 1 })

    await assemble(ctx, { model: 'nulu-5', messages: [], sessionId: session.id })
    const request = server.requests[0] as {
      nulu_session_log?: {
        version: number
        session: { id: string }
        afterSeq: number
        throughSeq: number
        events: Array<{ type: string; seq: number }>
      }
    }
    expect(request.nulu_session_log).toMatchObject({
      version: 1,
      session: { id: 'extension-composition-enabled' },
      afterSeq: -1,
      throughSeq: 0,
      events: [{ type: 'turn/start', seq: 0 }],
    })
    expect(SessionLogGateway.acceptedThrough(session)).toBe(0)
  })

  it('boots from cordis.yml and routes the next request after external settings and credential edits', async () => {
    vi.stubEnv('WORLD_APP_TECHNOLOGIES_API_KEY', '')
    const serverA = await mockServer([{ kind: 'sse', events: textEvents }])
    const serverB = await mockServer([{ kind: 'sse', events: textEvents }])
    const { ctx, settingsPath, credentialsPath } = await loadComposition({ withDynamic: true, baseURL: serverA.url })

    expect(ctx.get('settings')!.describe().map(entry => entry.ns)).toEqual([NS])
    await assemble(ctx, { model: 'nulu-5', messages: [] })
    expect(serverA.headers[0]?.authorization).toBe('Bearer boot-key')
    expect(serverA.headers[0]?.['x-nulu-harness-user-id']).toBe(getOrCreateAnonymousUserId())

    // External edits, exactly as a user or the web UI would leave them on disk.
    await writeFile(settingsPath, `llm-gateway:\n  baseURL: ${serverB.url}\n`)
    await vi.waitFor(() => {
      expect((ctx.get('settings')!.get(NS) as { baseURL?: string }).baseURL).toBe(serverB.url)
    }, { timeout: 5000 })
    await writeFile(credentialsPath, 'version: 1\nrefs:\n  WORLD_APP_TECHNOLOGIES_API_KEY: rotated-key\n', { mode: 0o600 })
    await vi.waitFor(async () => {
      expect(await ctx.get('credentials')!.resolve(KEY_REF)).toEqual({ value: 'rotated-key', source: 'file' })
    }, { timeout: 5000 })

    await assemble(ctx, { model: 'nulu-5', messages: [] })
    expect(serverA.requests).toHaveLength(1)
    expect(serverB.headers[0]?.authorization).toBe('Bearer rotated-key')
  })

  it('keeps a stored key writable and rotatable across a real restart', async () => {
    // No ambient WORLD_APP_TECHNOLOGIES_API_KEY: the shipped surfaces do not hoist
    // the credentials document into process.env, so a stored key must stay file-sourced.
    vi.stubEnv('WORLD_APP_TECHNOLOGIES_API_KEY', '')
    const first = await mockServer([{ kind: 'sse', events: textEvents }])
    const second = await mockServer([{ kind: 'sse', events: textEvents }])
    const boot = await loadComposition({ withDynamic: true, baseURL: first.url })
    const home = root!
    await boot.ctx.get('credentials')!.set(KEY_REF, 'stored-by-ui')
    expect(await boot.ctx.get('credentials')!.describe(KEY_REF))
      .toEqual({ configured: true, source: 'file', writable: true })
    await assemble(boot.ctx, { model: 'nulu-5', messages: [] })
    expect(first.headers[0]?.authorization).toBe('Bearer stored-by-ui')
    await boot.ctx.fiber.dispose()
    context = undefined

    // Restart over the same harness home.
    const restarted = await loadComposition({ withDynamic: true, baseURL: second.url, reuseRoot: home })
    const credentials = restarted.ctx.get('credentials')!
    // The stored key is still the provider's own writable file entry — not a
    // read-only launch override, which is what hoisting it would have made it.
    expect(await credentials.resolve(KEY_REF)).toEqual({ value: 'stored-by-ui', source: 'file' })
    expect(await credentials.describe(KEY_REF)).toEqual({ configured: true, source: 'file', writable: true })
    // Rotation still works after the restart, and the next request uses it.
    await credentials.set(KEY_REF, 'rotated-after-restart')
    await assemble(restarted.ctx, { model: 'nulu-5', messages: [] })
    expect(second.headers[0]?.authorization).toBe('Bearer rotated-after-restart')
  })

  it('boots the same adapter on entry config alone, resolving the reference from the environment', async () => {
    // No settings and no credentials provider: configuration carries only the
    // reference, so the environment is the whole credential plane here.
    vi.stubEnv('WORLD_APP_TECHNOLOGIES_API_KEY', 'entry-key')
    const server = await mockServer([{ kind: 'sse', events: textEvents }])
    const { ctx } = await loadComposition({ withDynamic: false, baseURL: server.url })

    expect(ctx.get('settings')).toBeUndefined()
    expect(ctx.get('credentials')).toBeUndefined()
    await assemble(ctx, { model: 'nulu-5', messages: [] })
    expect(server.headers[0]?.authorization).toBe('Bearer entry-key')
  })
})
