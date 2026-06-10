import { Config, Build } from '../../core/index.ts'

import { Node } from '../../_lib/index.ts'

import { clientFiles } from '../env.ts'
import { createWriteStream } from 'node:fs'

export type ViteContext = {
  dir: string
  json: () => Promise<Config.ProjectVersion>
  file: () => Promise<string | undefined>
  current: () => Promise<Build.BuildResult>
  rebuild: () => Promise<void>
  on: (cb: () => void) => () => void
}

export type ViteContextOptions = { dir: string }
export const makeContext = (opts: { dir: string }): ViteContext => {
  const builder = Build.loadBuilder(opts.dir)
  builder.rebuild()
  return { ...builder, dir: opts.dir }
}

/** Prefix root-absolute `href`/`src` URLs (not `//` or protocols) with `base`. */
const withBaseHtml = (html: string, baseUrl: string): string => {
  const base = baseUrl.replace(/\/+$/, '')
  return base ? html.replace(/\b(href|src)="\/(?!\/)/g, `$1="${base}/`) : html
}

export const htmlShellGenerator = async () => {
  const template = await Node.Fs.readFile(clientFiles.htmlTemplate, 'utf8')
  return (opts: { body: string; head: string; title: string }) =>
    template.replace('{{TITLE}}', opts.title).replace('{{BODY}}', opts.body).replace('{{HEAD}}', opts.head)
}

export const createShellStreamer = async (baseUrl = '/') => {
  const template = await Node.Fs.readFile(clientFiles.htmlTemplate, 'utf8')
  // Split the template exactly at the {{BODY}} placeholder. Rewrite the
  // template's own root-absolute assets (e.g. favicons) against `base` — the
  // injected head/css are already prefixed, and {{...}} placeholders have no
  // href/src so they're untouched.
  const [beforeBody, afterBody] = withBaseHtml(template, baseUrl).split('{{BODY}}') as [string, string]

  return (filePath: string, opts: { title?: string; head?: string; script?: string }) => {
    // Prepare the header chunk
    const headerChunk = beforeBody.replace('{{TITLE}}', opts.title ?? 'Document').replace('{{HEAD}}', opts.head ?? '')

    // 1. Create a native file write stream
    const fileStream = createWriteStream(filePath)

    // 2. Write the opening HTML layout immediately to the file
    fileStream.write(headerChunk)
    fileStream.write('<div id="root">')

    // 3. Intercept the standard .end() method
    const originalEnd = fileStream.end.bind(fileStream)

    // If end() was called with final data, write it first

    fileStream.end = function (
      this: typeof fileStream,
      chunkOrCb?: any,
      encodingOrCb?: BufferEncoding | (() => void),
      callback?: () => void,
    ): typeof fileStream {
      // Normalize the overloaded arguments
      let chunk: any
      let encoding: BufferEncoding | undefined
      let cb: (() => void) | undefined

      if (typeof chunkOrCb === 'function') {
        cb = chunkOrCb
      } else {
        chunk = chunkOrCb
        if (typeof encodingOrCb === 'function') {
          cb = encodingOrCb
        } else {
          encoding = encodingOrCb
          cb = callback
        }
      }

      // If end() was called with final data, write it first
      if (chunk !== undefined) {
        this.write(chunk, encoding as BufferEncoding)
      }

      // Close the root div
      this.write('</div>')

      // Inject the script tag after the root div, inside the body
      if (opts.script) {
        this.write(opts.script)
      }

      // Append the closing HTML tags right before sealing the file
      this.write(afterBody)

      // Call the original end method to safely close the file descriptor
      return originalEnd(cb)
    }

    return fileStream
  }
}
