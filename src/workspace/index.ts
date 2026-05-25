import path from 'node:path'

import * as pkgJson from '../pkg-json/index.ts'
import * as tsconf from '../tsconfig/index.ts'
import * as util from '../util/index.ts'

export const tsconfig = util.memoize((tsconfigPath?: string) => compilerOptions(tsconfigPath))

export const projectName = async (dir: string = process.cwd()) => pkg(dir).then((p) => p?.name)

const pkg = util.memoize(async (dir: string = process.cwd()) => pkgJson.read(path.join(dir, 'package.json')))

const compilerOptions = async (tsconfigPath?: string) => {
  let pth = tsconfigPath
  if (!pth) pth = await tsconf.find()
  if (!pth) throw new Error('No tsconfig.json found')
  const config = tsconf.read(pth)
  return tsconf.parse(pth, config)
}
