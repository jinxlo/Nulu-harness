import { spawnSync } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@worldapptechnologies/cordis'
import Loader from '@worldapptechnologies/cordis-plugin-loader'
import Include from '@worldapptechnologies/cordis-plugin-include'
import { ToolCallId } from '@worldapptechnologies/nulu-llm'
import { SESSION_FORMAT_VERSION, Session, SessionId } from '@worldapptechnologies/nulu-session'
import AgentRegistry from '@worldapptechnologies/nulu-agent'
import SessionProjectionRegistry from '@worldapptechnologies/nulu-session-projection'
import type { Agent } from '@worldapptechnologies/nulu-agent'
import TerminalSessionService from '@worldapptechnologies/nulu-terminal'
import * as TerminalBash from '@worldapptechnologies/nulu-terminal-bash'
import SandboxProvider from '@worldapptechnologies/nulu-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@worldapptechnologies/nulu-sandbox'
import SandboxPolicyService from '@worldapptechnologies/nulu-sandbox-policy'
import LocalSubprocessService from '@worldapptechnologies/nulu-subprocess-local'
import { resolvePwshPath } from '@worldapptechnologies/nulu-pwsh-local/src/resolve.ts'
import SystemPrompt from '@worldapptechnologies/nulu-system-prompt'
import ToolRegistry from '@worldapptechnologies/nulu-tools'
import * as ToolPwshPersistent from '@worldapptechnologies/nulu-tool-pwsh-persistent'
import { unsupportedInbox } from '@worldapptechnologies/nulu-agent-loop-testkit'

const hasPwsh = spawnSync(
  resolvePwshPath(), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$true'],
  { encoding: 'utf8' },
).status === 0

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

class PassthroughSandbox extends SandboxProvider {
  confine(argv: readonly string[], _policy: SandboxPolicy): ConfinedArgv {
    return { argv: [...argv], enforcement: 'full', denialSignatures: [], runnerFailureRules: [] }
  }
}

function agent(ctx: Context, cwd: string): Agent {
  const id = SessionId('persistent-pwsh-loader-agent')
  const scope = ctx.plugin(() => {})
  const session = Session.create(id, [], {
    version: SESSION_FORMAT_VERSION, id, createdAt: 0, cwd, isSeeded: false,
  })
  const value: Agent = {
    id,
    options: {},
    session,
    inbox: unsupportedInbox(),
    status: 'idle',
    ctx: scope.ctx,
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => {},
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(value)
  return value
}

function text(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

describe.skipIf(!hasPwsh)('persistent pwsh through a real cordis.yml Loader composition', () => {
  it('preserves cwd and environment across calls', async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'nulu-persistent-pwsh-loader-')))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@worldapptechnologies/nulu-agent'",
      "- name: '@worldapptechnologies/nulu-system-prompt'",
      "- name: '@worldapptechnologies/nulu-tools'",
      "- name: '@worldapptechnologies/nulu-terminal'",
      "- name: '@worldapptechnologies/nulu-test-sandbox'",
      "- name: '@worldapptechnologies/nulu-session-projection'",
      "- name: '@worldapptechnologies/nulu-sandbox-policy'",
      '  config:',
      '    mode: danger-full-access',
      `    workspaceRoot: ${JSON.stringify(root)}`,
      "- name: '@worldapptechnologies/nulu-subprocess-local'",
      "- name: '@worldapptechnologies/nulu-terminal-bash'",
      '  config:',
      '    shellDialect: pwsh',
      '    pollIntervalMs: 10',
      '    exactProbeAfterMs: 20',
      '    idleSilenceMs: 300',
      '    handoffGraceMs: 300',
      '    scrollbackLines: 20000',
      // The first call pays the full pwsh cold-start latency (spawn + .NET +
      // PSReadLine + Defender) inside the tool deadline; a 60s bound on the
      // fully loaded self-hosted Windows pool is exceeded often enough to
      // reset the session mid-test (2026-09-01, two runs ~62s each). 300s
      // matches the nulu-tool-pwsh-persistent product default; the
      // nulu-terminal-bash value bounds one send plus the complete startup
      // sequence, so it covers the same cold start (its 30s product default
      // would not).
      '    timeoutMs: 300000',
      '    disposeGraceMs: 500',
      "- name: '@worldapptechnologies/nulu-tool-pwsh-persistent'",
      '  config:',
      '    timeoutMs: 300000',
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@worldapptechnologies/nulu-agent', AgentRegistry],
      ['@worldapptechnologies/nulu-system-prompt', SystemPrompt],
      ['@worldapptechnologies/nulu-tools', ToolRegistry],
      ['@worldapptechnologies/nulu-terminal', TerminalSessionService],
      ['@worldapptechnologies/nulu-test-sandbox', PassthroughSandbox],
      ['@worldapptechnologies/nulu-session-projection', SessionProjectionRegistry],
      ['@worldapptechnologies/nulu-sandbox-policy', SandboxPolicyService],
      ['@worldapptechnologies/nulu-subprocess-local', LocalSubprocessService],
      ['@worldapptechnologies/nulu-terminal-bash', TerminalBash],
      ['@worldapptechnologies/nulu-tool-pwsh-persistent', ToolPwshPersistent],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await context.loader.await()

    const owner = agent(context, root)
    const signal = new AbortController().signal
    const execute = (id: string, command: string) => context!.tools.execute({
      signal,
      callId: ToolCallId(id),
      name: 'pwsh',
      arguments: { command },
      agent: owner,
    })

    expect(context.tools.schemas().map(schema => schema.name)).toEqual(['pwsh'])
    await execute('state', '$env:KEEP = "loader"; New-Item -ItemType Directory -Force -Path nested | Out-Null; Set-Location nested')
    const observed = text(await execute('observe', 'Write-Output "cwd=$PWD keep=$env:KEEP"'))
    expect(observed).toContain(`cwd=${join(root, 'nested')} keep=loader`)
    expect(observed).not.toContain('NULU_PERSISTENT_PWSH')

    const multiline = text(await execute(
      'multiline',
      '$value = "line one"\nWrite-Output "${value}:it\'s fine"',
    ))
    expect(multiline).toBe("line one:it's fine")
    expect(multiline).not.toContain('NULU_PERSISTENT_PWSH')

    const hereString = text(await execute(
      'here-string',
      "$h = @'\nalpha\nbeta\n'@\nWrite-Output $h",
    ))
    expect(hereString).toBe('alpha\nbeta')

    const large = text(await execute('large-output', '1..12050 | ForEach-Object { $_ }'))
    expect(large.startsWith('1\n2\n3\n')).toBe(true)
    expect(large).toContain('<response clipped>')
    expect(large).not.toContain('beginning of this command output was dropped')

    const exited = text(await execute('exit', 'exit'))
    expect(exited).toContain('next pwsh call starts from the workspace')
    expect(text(await execute('after-exit', 'Write-Output "$PWD"'))).toBe(root)
  }, 120_000)
})
