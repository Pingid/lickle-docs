import { Application, OptionDefaults, PackageJsonReader, TSConfigReader } from 'typedoc'

export const generate = async (files: string[]) => {
  const app = await Application.bootstrapWithPlugins(
    {
      ...(OptionDefaults as any),
      entryPoints: files,
    },
    [new TSConfigReader(), new PackageJsonReader()],
  )
  const project = await app.convert()
  if (!project) throw new Error('No project found')
  await app.generateJson(project, 'typdoc.json')
}
