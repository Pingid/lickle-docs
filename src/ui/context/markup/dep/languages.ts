import { bundledLanguagesInfo } from 'shiki/langs'

export const languages = bundledLanguagesInfo.map((l) => ({ name: l.name, import: l.import }))
