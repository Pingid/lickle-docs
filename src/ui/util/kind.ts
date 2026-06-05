/**
 * Declaration-kind metadata (labels, short glyphs, plural section titles, group
 * ordering) lives in core so route generation and the UI share one source of
 * truth. Re-exported here for the UI's existing import path.
 */
export * from '../../core/project/kind.ts'
