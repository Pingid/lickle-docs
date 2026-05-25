#!/usr/bin/env -S node --experimental-strip-types

import { run } from 'cmd-ts'
import { app } from './cli/index.ts'

run(app(), process.argv.slice(2))
