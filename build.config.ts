import { defineBuildConfig } from 'unbuild'
import fs from 'node:fs/promises'
import path from 'node:path'

export default defineBuildConfig({
  externals: ['typescript'],
  declaration: true,
  hooks: {
    'build:done': async (ctx) => {
      const dtsPath = path.join(ctx.options.outDir, 'preset/index.d.ts')
      const exists = await fs.stat(dtsPath).catch(() => false)
      if (!exists) return
      console.log(`Writing headers to ${dtsPath}`)
      const dtsContent = await fs.readFile(dtsPath, 'utf8')
      const headers = ['/// <reference types="vite/client" />', '/// <reference types="solid-js/jsx-runtime" />']
      await fs.writeFile(dtsPath, `${headers.join('\n')}\n${dtsContent}`, 'utf8')
    },
  },
})
