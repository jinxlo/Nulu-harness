#!/usr/bin/env node
/** The `nulu` command of the nulu-harness package: starts the launcher that ships in runtime/node_modules/@worldapptechnologies/nulu. */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startArguments } from './start.js'

const start = startArguments(process.argv.slice(2), process.stdin.isTTY === true && process.stdout.isTTY === true)
if (start.notice !== undefined) console.error(start.notice)
process.argv.splice(2, process.argv.length - 2, ...start.args)
const launcher = join(dirname(createRequire(new URL('./runtime/', import.meta.url)).resolve('@worldapptechnologies/nulu/package.json')), 'lib', 'bin.js')
// The launcher runs itself only as a program's entry file, so this command calls its exported entry function.
const { runCli } = await import(pathToFileURL(launcher).href)
if (typeof runCli === 'function') await runCli()
else {
  // A launcher without that function still works as its own program.
  const child = spawnSync(process.execPath, [launcher, ...start.args], { stdio: 'inherit' })
  process.exit(child.status ?? 1)
}
