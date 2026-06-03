import type * as core from '../../../../core/index.ts'

export const htmlShell = (opts: {
  body: string
  head: string // Solid hydration script (defines window._$HY) + any SSR head tags
  json: core.project.ProjectJson
  clientSrc: string // hashed bundle path from the client build manifest
  cssHref: string // hashed css path
  projectScript: string
  base: string
}): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.json.name}</title>
  <link rel="stylesheet" href="${opts.cssHref}" />
  ${opts.head}
</head>
<body>
  <div id="root">${opts.body}</div>
  ${opts.projectScript}
  <script type="module" src="${opts.clientSrc}"></script>
</body>
</html>`
