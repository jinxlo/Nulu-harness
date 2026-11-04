#!/usr/bin/env node
/** Apply Nulu mappings without rewriting policy, release tooling, legal notices, or protocol identifiers. */
import { rebrandTree } from './automation/brand-tree.mjs'
const changes = rebrandTree({ check: process.argv.includes('--check') })
console.log(`[rebrand-upstream] ${changes.length} file(s) ${process.argv.includes('--check') ? 'require changes' : 'updated'}`)
