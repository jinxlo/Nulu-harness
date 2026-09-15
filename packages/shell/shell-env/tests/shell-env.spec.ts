/**
 * Registry tests for `@worldapptechnologies/nulu-shell-env`: built-in facts, contributor
 * ownership and validation, collection ordering, effect-scoped disposal, and
 * the explicit disposer contract.
 */

import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@worldapptechnologies/cordis'
import { ToolCallId } from '@worldapptechnologies/nulu-llm'
import type { Agent } from '@worldapptechnologies/nulu-agent'
import { SESSION_FORMAT_VERSION } from '@worldapptechnologies/nulu-session'
import type { ToolExecution } from '@worldapptechnologies/nulu-tools'
import { ShellEnvRegistry } from '@worldapptechnologies/nulu-shell-env'
import * as BashEnvPlugin from '@worldapptechnologies/nulu-shell-env'

const testToolSignal = new AbortController().signal

afterEach(() => vi.unstubAllEnvs())

function execution(sessionId?: string): ToolExecution {
  return {
    signal: testToolSignal,
    token: Symbol('bash-env-test') as ToolExecution['token'],
    callId: ToolCallId('bash-env-call'),
    rootCallId: ToolCallId('bash-env-call'),
    name: 'bash',
    arguments: { command: 'true' },
    ...(sessionId === undefined
      ? {}
      : {
        agent: {
          session: {
            header: { version: SESSION_FORMAT_VERSION, id: sessionId, createdAt: 0, isSeeded: false },
          },
        } as unknown as Agent,
      }),
  }
}

describe('ShellEnvRegistry', () => {
  it('collects unconditional shell facts and the current agent session id', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { nuluHome: './test-nulu-home' })

    expect(registry.collect(execution())).toEqual({
      NULU_HOME: resolve('./test-nulu-home'),
      NULU_SHELL: '1',
    })
    expect(registry.collect(execution('session-a'))).toEqual({
      NULU_HOME: resolve('./test-nulu-home'),
      NULU_SESSION_ID: 'session-a',
      NULU_SHELL: '1',
    })
  })

  it('resolves NULU_HOME from the ambient override or the user-home default', () => {
    vi.stubEnv('NULU_HOME', './ambient-nulu-home')
    const fromEnvironment = new ShellEnvRegistry(new Context())
    expect(fromEnvironment.collect(execution()).NULU_HOME).toBe(resolve('./ambient-nulu-home'))

    vi.stubEnv('NULU_HOME', undefined)
    const fromDefault = new ShellEnvRegistry(new Context())
    expect(fromDefault.collect(execution()).NULU_HOME).toBe(join(homedir(), '.nulu'))
  })

  it('collects declared contributor variables and omits unavailable values', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { nuluHome: './test-nulu-home' })
    registry.register({
      name: 'optional-session-fact',
      variables: {
        NULU_SESSION_OPTIONAL: { description: 'Optional session-scoped test fact.' },
      },
      resolve: exec => exec.agent === undefined ? {} : { NULU_SESSION_OPTIONAL: exec.agent.session.header.id },
    })
    registry.register({
      name: 'always-available-fact',
      variables: {
        NULU_ALWAYS_AVAILABLE: { description: 'Always-available test fact.' },
      },
      resolve: () => ({ NULU_ALWAYS_AVAILABLE: 'yes' }),
    })

    expect(registry.collect(execution())).not.toHaveProperty('NULU_SESSION_OPTIONAL')
    expect(registry.collect(execution()).NULU_ALWAYS_AVAILABLE).toBe('yes')
    expect(registry.collect(execution('session-b')).NULU_SESSION_OPTIONAL).toBe('session-b')
    expect(registry.list()).toEqual([
      {
        contributor: 'always-available-fact',
        description: 'Always-available test fact.',
        key: 'NULU_ALWAYS_AVAILABLE',
      },
      {
        contributor: 'optional-session-fact',
        description: 'Optional session-scoped test fact.',
        key: 'NULU_SESSION_OPTIONAL',
      },
    ])
  })

  it('rejects duplicate variable ownership at registration time', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { nuluHome: './test-nulu-home' })
    registry.register({
      name: 'first',
      variables: { NULU_SHARED: { description: 'First owner.' } },
      resolve: () => ({ NULU_SHARED: 'first' }),
    })

    expect(() => registry.register({
      name: 'second',
      variables: { NULU_SHARED: { description: 'Second owner.' } },
      resolve: () => ({ NULU_SHARED: 'second' }),
    })).toThrow(/NULU_SHARED.*first.*second|NULU_SHARED.*second.*first/)
  })

  it('rejects duplicate contributor names and malformed declarations', () => {
    const registry = new ShellEnvRegistry(new Context(), { nuluHome: './test-nulu-home' })
    registry.register({
      name: 'declared',
      variables: { NULU_DECLARED: { description: 'Declared fact.' } },
      resolve: () => ({}),
    })

    expect(() => registry.register({
      name: 'declared',
      variables: { NULU_ANOTHER: { description: 'Another fact.' } },
      resolve: () => ({}),
    })).toThrow(/already registered/)
    expect(() => registry.register({
      name: ' ',
      variables: { NULU_BLANK_NAME: { description: 'Blank owner.' } },
      resolve: () => ({}),
    })).toThrow(/name must be non-empty/)
    expect(() => registry.register({
      name: 'invalid-key',
      variables: { nulu_invalid: { description: 'Invalid key.' } } as unknown as Record<'NULU_INVALID', { description: string }>,
      resolve: () => ({}),
    })).toThrow(/invalid key/)
    expect(() => registry.register({
      name: 'reserved-key',
      variables: { NULU_HOME: { description: 'Reserved key.' } },
      resolve: () => ({}),
    })).toThrow(/reserved key/)
    expect(() => registry.register({
      name: 'blank-description',
      variables: { NULU_BLANK_DESCRIPTION: { description: ' ' } },
      resolve: () => ({}),
    })).toThrow(/must describe/)
  })

  it('rejects undeclared variables returned by a contributor', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { nuluHome: './test-nulu-home' })
    registry.register({
      name: 'drifted-provider',
      variables: { NULU_DECLARED: { description: 'Declared fact.' } },
      resolve: () => ({ NULU_UNDECLARED: 'bad' }),
    })

    expect(() => registry.collect(execution())).toThrow(/drifted-provider.*NULU_UNDECLARED/)
  })

  it('rejects non-string values returned by a contributor', () => {
    const registry = new ShellEnvRegistry(new Context(), { nuluHome: './test-nulu-home' })
    registry.register({
      name: 'wrong-value-type',
      variables: { NULU_STRING: { description: 'String fact.' } },
      resolve: () => ({ NULU_STRING: 42 }) as unknown as Record<'NULU_STRING', string>,
    })

    expect(() => registry.collect(execution())).toThrow(/wrong-value-type.*non-string.*NULU_STRING/)
  })

  it('removes an effect-scoped contributor when its plugin is disposed', async () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { nuluHome: './test-nulu-home' })
    const fiber = await ctx.plugin({
      inject: ['shellEnv'],
      apply(inner: Context) {
        inner.shellEnv.register({
          name: 'temporary',
          variables: { NULU_TEMPORARY: { description: 'Temporary fact.' } },
          resolve: () => ({ NULU_TEMPORARY: 'present' }),
        })
      },
    })

    expect(registry.collect(execution()).NULU_TEMPORARY).toBe('present')
    await fiber.dispose()
    expect(registry.collect(execution())).not.toHaveProperty('NULU_TEMPORARY')
  })

  it('returns an explicit contributor disposer', () => {
    const registry = new ShellEnvRegistry(new Context(), { nuluHome: './test-nulu-home' })
    const dispose = registry.register({
      name: 'explicit-disposal',
      variables: { NULU_EXPLICIT_DISPOSAL: { description: 'Explicitly disposed fact.' } },
      resolve: () => ({ NULU_EXPLICIT_DISPOSAL: 'present' }),
    })

    expect(registry.collect(execution()).NULU_EXPLICIT_DISPOSAL).toBe('present')
    dispose()
    expect(registry.collect(execution())).not.toHaveProperty('NULU_EXPLICIT_DISPOSAL')
  })

  it('the plugin registers the service with no contributors on load', async () => {
    const ctx = new Context()
    await ctx.plugin(BashEnvPlugin)
    expect(ctx.shellEnv).toBeInstanceOf(ShellEnvRegistry)
    expect(ctx.shellEnv.list()).toEqual([])
  })
})
