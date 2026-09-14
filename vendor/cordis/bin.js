#!/usr/bin/env node

import { Context } from '@worldapptechnologies/cordis'
import { pathToFileURL } from 'node:url'
import Loader from '@worldapptechnologies/cordis-plugin-loader'

const ctx = new Context()
ctx.baseUrl = pathToFileURL(process.cwd()).href + '/'

await ctx.plugin(Loader)
await ctx.loader.create({
  name: '@worldapptechnologies/cordis-plugin-include',
  config: {
    path: './cordis.yml',
  },
})
