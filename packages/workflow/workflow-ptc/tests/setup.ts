import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@worldapptechnologies/cordis'
import type { Agent } from '@worldapptechnologies/nulu-agent'
import SessionStore from '@worldapptechnologies/nulu-session'
import SessionProjections from '@worldapptechnologies/nulu-session-projection'
import FileSystem from '@worldapptechnologies/nulu-fs-local'
import Subprocess from '@worldapptechnologies/nulu-subprocess-local'
import Sandbox from '@worldapptechnologies/nulu-sandbox-local'
import SandboxPolicy from '@worldapptechnologies/nulu-sandbox-policy'
import type { SandboxMode } from '@worldapptechnologies/nulu-sandbox'
import NodePtcRuntime from '@worldapptechnologies/nulu-ptc-runtime-node'
import type { Config as NodeRuntimeConfig } from '@worldapptechnologies/nulu-ptc-runtime-node'
import { onTestFinished } from 'vitest'

/** Mount real Node execution services with a private working directory and awaited cleanup. */
export async function mountPtcRuntime(ctx: Context, mode: SandboxMode = 'danger-full-access') {
  const root = await mkdtemp(join(homedir(), '.nulu-workflow-test-'))
  onTestFinished(async () => {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  })
  const cwd = join(root, 'workspace')
  await mkdir(cwd)
  await mountWorkflowRuntime(ctx, { cwd, mode, runtimeConfig: { graceMs: 50 } })
  return { root, cwd }
}

/** Mount the real execution services in a caller-owned context and directory. */
export async function mountWorkflowRuntime(
  ctx: Context,
  options: { cwd?: string; mode?: SandboxMode; runtimeConfig?: NodeRuntimeConfig } = {},
): Promise<NodePtcRuntime> {
  if (!ctx.get('sessions')) await ctx.plugin(SessionStore)
  if (!ctx.get('sessionProjections')) await ctx.plugin(SessionProjections)
  if (!ctx.get('fs')) await ctx.plugin(FileSystem)
  if (!ctx.get('subprocess')) await ctx.plugin(Subprocess)
  if (!ctx.get('sandbox')) await ctx.plugin(Sandbox)
  if (!ctx.get('sandboxPolicy')) await ctx.plugin(SandboxPolicy, {
    mode: options.mode ?? 'danger-full-access',
    ...options.cwd === undefined ? {} : { workspaceRoot: options.cwd },
  })
  if (!ctx.get('ptcRuntime')) await ctx.plugin(NodePtcRuntime, options.runtimeConfig ?? {})
  return ctx.ptcRuntime as NodePtcRuntime
}

/** Give a stub subagent provider a parent with a real Session and immutable cwd. */
export function fakeParent(ctx: Context): Agent {
  const session = ctx.sessions.create(undefined, { meta: { cwd: ctx.sandboxPolicy.workspaceRoot } })
  return { id: session.id, session, options: {} } as unknown as Agent
}
