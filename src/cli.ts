#!/usr/bin/env node

import { app } from './cli/index.ts'
import { run } from 'cmd-ts'

run(await app(), process.argv.slice(2))
