#!/usr/bin/env node
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineCommand, runMain } from 'citty'
import { extractToDir } from '.'
import { version } from '../package.json' with { type: 'json' }

const main = defineCommand({
  meta: {
    name: 'ase',
    version,
    description: 'Aseprite CLI',
  },
  args: {
    input: {
      type: 'positional',
      description: 'Input Aseprite file',
      valueHint: 'file.aseprite',
      required: true,
    },
    outDir: {
      type: 'string',
      description: 'Output directory for the generated files, it will be created if it does not exist',
      required: true,
    },
  },
  async run({ args }) {
    const input = args.input
    const outDir = resolve(args.outDir)

    await mkdir(outDir, { recursive: true })
    await extractToDir(input, outDir)

    console.log(`Aseprite file extracted to ${outDir}`)
  },
})

runMain(main)
