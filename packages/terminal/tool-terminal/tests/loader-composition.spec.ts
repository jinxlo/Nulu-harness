import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@worldapptechnologies/cordis'
import Loader from '@worldapptechnologies/cordis-plugin-loader'
import Include from '@worldapptechnologies/cordis-plugin-include'
import { ToolCallId } from '@worldapptechnologies/nulu-llm'
import { Session, SessionId } from '@worldapptechnologies/nulu-session'
import AgentRegistry from '@worldapptechnologies/nulu-agent'
import type { Agent } from '@worldapptechnologies/nulu-agent'
import SystemPrompt from '@worldapptechnologies/nulu-system-prompt'
import ToolRuntime from '@worldapptechnologies/nulu-tools'
import TerminalSessionService from '@worldapptechnologies/nulu-terminal'
import SandboxProvider from '@worldapptechnologies/nulu-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@worldapptechnologies/nulu-sandbox'
import SandboxPolicyService from '@worldapptechnologies/nulu-sandbox-policy'
import SessionProjectionRegistry from '@worldapptechnologies/nulu-session-projection'
import LocalSubprocessRuntime from '@worldapptechnologies/nulu-subprocess-local'
import * as TerminalLocal from '@worldapptechnologies/nulu-terminal-bash'
import * as ToolPty from '@worldapptechnologies/nulu-tool-terminal'
import { unsupportedInbox } from '@worldapptechnologies/nulu-agent-loop-testkit'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

class PassthroughSandbox extends SandboxProvider {
  async confine(argv: readonly string[], _policy: SandboxPolicy): Promise<ConfinedArgv> {
    return { argv: [...argv], enforcement: 'full', denialSignatures: [], runnerFailureRules: [] }
  }
}

async function agent(ctx: Context): Promise<Agent> {
  const scope = ctx.plugin(() => {})
  const id = SessionId('pty-loader-agent')
  const session = Session.create(id)
  const value: Agent = {
    id, options: {}, session, inbox: unsupportedInbox(),
    status: 'idle',
    ctx: scope.ctx,
    send: () => {},
    followup: () => {}, steer: () => {}, inject: () => {}, cancel() {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  await ctx.agents.register(value)
  return value
}

function resultText(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

const suite = process.platform === 'linux' || process.platform === 'darwin' ? describe : describe.skip

suite('terminal real Loader composition through cordis.yml', () => {
  it('boots cordis.yml and preserves shell state across real tool calls', async () => {
    root = await mkdtemp(join(tmpdir(), 'nulu-pty-loader-'))
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
      '    pollIntervalMs: 10',
      '    exactProbeAfterMs: 20',
      '    idleSilenceMs: 250',
      '    handoffGraceMs: 250',
      '    timeoutMs: 2000',
      '    disposeGraceMs: 500',
      "- name: '@worldapptechnologies/nulu-tool-terminal'",
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@worldapptechnologies/nulu-agent', AgentRegistry],
      ['@worldapptechnologies/nulu-system-prompt', SystemPrompt],
      ['@worldapptechnologies/nulu-tools', ToolRuntime],
      ['@worldapptechnologies/nulu-terminal', TerminalSessionService],
      ['@worldapptechnologies/nulu-test-sandbox', PassthroughSandbox],
      ['@worldapptechnologies/nulu-session-projection', SessionProjectionRegistry],
      ['@worldapptechnologies/nulu-sandbox-policy', SandboxPolicyService],
      ['@worldapptechnologies/nulu-subprocess-local', LocalSubprocessRuntime],
      ['@worldapptechnologies/nulu-terminal-bash', TerminalLocal],
      ['@worldapptechnologies/nulu-tool-terminal', ToolPty],
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

    const owner = await agent(context)
    const signal = new AbortController().signal
    const spawn = await context.tools.execute({
      signal, callId: ToolCallId('spawn'), name: 'terminal_open', arguments: { type: 'shell', name: 'main', cwd: root }, agent: owner,
    })
    expect(resultText(spawn)).toContain('started terminal session pty-1 (main)')

    await context.tools.execute({
      signal, callId: ToolCallId('state'), name: 'terminal_send', arguments: { sessionId: 'pty-1', text: 'export KEEP=loader; cd /' }, agent: owner,
    })
    const read = await context.tools.execute({
      signal, callId: ToolCallId('read'), name: 'terminal_send', arguments: { sessionId: 'pty-1', text: 'printf "cwd=%s keep=%s\\n" "$PWD" "$KEEP"' }, agent: owner,
    })
    expect(resultText(read)).toContain('cwd=/ keep=loader')
    expect(context.terminals.list(owner)).toHaveLength(1)
  }, 15_000)
})
