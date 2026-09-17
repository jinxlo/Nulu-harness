/** The standalone SDK-minimal bundle's complete declared Cordis tree. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { entryListSchema } from '@worldapptechnologies/cordis-plugin-include'

function packageName(specifier: string): string {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!
}

describe('nulu-sdk-minimal bundle', () => {
  it('declares one standalone allowlisted tree with every row dependency', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      nulu?: { bundle?: { patch?: string } }
    }
    expect(manifest.nulu?.bundle?.patch).toBe('./cordis.patch.yml')
    const patches = yaml.load(
      readFileSync(resolve(root, manifest.nulu!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    ) as Array<{ insert?: Array<{ id?: string; inject?: string[]; name?: string; config?: Record<string, unknown>; disabled?: unknown }> }>
    expect(patches).toHaveLength(1)
    const rows = patches[0]?.insert ?? []
    expect(rows.map(row => [row.id, row.name])).toEqual([
      ['sdk-app-startup', '@worldapptechnologies/nulu-sdk-app'],
      ['sdk-jsonrpc-server', '@worldapptechnologies/nulu-sdk-jsonrpc-server'],
      ['deepseek-llm-api-extensions', '@worldapptechnologies/nulu-deepseek-llm-api-extensions'],
      ['session-log-deepseek', '@worldapptechnologies/nulu-session-log-deepseek'],
      ['plugin-package-inventory-deepseek', '@worldapptechnologies/nulu-plugin-package-inventory-deepseek'],
      ['llm-deepseek', '@worldapptechnologies/nulu-llm-deepseek'],
      ['sandbox', '@worldapptechnologies/nulu-sandbox-local'],
      ['session-projection', '@worldapptechnologies/nulu-session-projection'],
      ['sandbox-policy', '@worldapptechnologies/nulu-sandbox-policy'],
      ['subprocess', '@worldapptechnologies/nulu-subprocess-local'],
      ['pty', '@worldapptechnologies/nulu-terminal'],
      ['terminal-bash', '@worldapptechnologies/nulu-terminal-bash'],
      ['terminal-pwsh', '@worldapptechnologies/nulu-terminal-bash'],
      ['timer', '@worldapptechnologies/cordis-plugin-timer'],
      ['llm', '@worldapptechnologies/nulu-llm'],
      ['session', '@worldapptechnologies/nulu-session'],
      ['session-title', '@worldapptechnologies/nulu-session-title'],
      ['system-prompt', '@worldapptechnologies/nulu-system-prompt'],
      ['tools', '@worldapptechnologies/nulu-tools'],
      ['mcp-resources', '@worldapptechnologies/nulu-mcp-resources'],
      ['agent', '@worldapptechnologies/nulu-agent'],
      ['llm-retry', '@worldapptechnologies/nulu-llm-retry'],
      ['jobs', '@worldapptechnologies/nulu-jobs-local'],
      ['invariants', '@worldapptechnologies/nulu-invariants'],
      ['session-invariant', '@worldapptechnologies/nulu-session/invariant'],
      ['agent-invariant', '@worldapptechnologies/nulu-agent/invariant'],
      ['scope-invariant', '@worldapptechnologies/nulu-scope/invariant'],
      ['agent-loop-invariant', '@worldapptechnologies/nulu-agent-loop/invariant'],
      ['agent-loop', '@worldapptechnologies/nulu-agent-loop'],
      ['persistent-bash', '@worldapptechnologies/nulu-tool-bash-persistent'],
      ['persistent-pwsh', '@worldapptechnologies/nulu-tool-pwsh-persistent'],
      ['sessions', '@worldapptechnologies/nulu-session-persistence-jsonl'],
    ])
    expect(rows.find(row => row.id === 'sdk-app-startup')?.config).toEqual({ profile: 'sdk-minimal' })
    expect(rows.find(row => row.id === 'sdk-jsonrpc-server')).toMatchObject({
      inject: ['sdkAppStartup', 'loader'],
      config: { maxTokensAsSuccess: false },
    })
    expect(rows.find(row => row.id === 'llm-gateway')?.config).toEqual({
      apiKeyEnv: 'WORLD_APP_TECHNOLOGIES_API_KEY',
      defaultContextWindow: { __jsExpr: 'Number(process.env.NULU_CONTEXT_WINDOW ?? 1000000)' },
      streamIdleTimeoutMs: 172800000,
    })
    expect(rows.find(row => row.id === 'system-prompt')?.config).toEqual({
      includeHarnessIdentity: false,
      includeRuntimeContext: false,
      personaPrefix: { __jsExpr: "process.env.NULU_SYSTEM_PROMPT ?? 'You are a helpful software engineer assistant.'" },
    })
    expect(rows.find(row => row.id === 'agent-loop')?.config).toEqual({ agents: [] })
    expect(rows.find(row => row.id === 'terminal-bash')).toMatchObject({
      disabled: { __jsExpr: "process.platform === 'win32'" },
    })
    expect(rows.find(row => row.id === 'terminal-pwsh')).toMatchObject({
      disabled: { __jsExpr: "process.platform !== 'win32'" },
      config: { shellDialect: 'pwsh', timeoutMs: 300000 },
    })
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(
      [...new Set(rows.map(row => row.name).filter((name): name is string => name !== undefined).map(packageName))].sort(),
    )
  })
})
