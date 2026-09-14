#!/usr/bin/env node
/** Private entry owned by the Python single-file runtime packaging. */

const selectorName = 'NULU_SUBPROCESS_RUNNER'
const selection = process.env[selectorName]

if (selection === undefined) {
  const { runCli } = await import('@worldapptechnologies/nulu/lib/bin.js')
  await runCli()
} else {
  Reflect.deleteProperty(process.env, selectorName)
  const { runSelectedSubprocessRunner } = await import('@worldapptechnologies/nulu-subprocess-local/runner')
  await runSelectedSubprocessRunner(selection)
}
