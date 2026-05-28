/**
 * A constant representing the maximum number of retries.
 */
export const MAX_RETRIES = 3;
/**
 * Parses a JSON string safely.
 * @param input The JSON string to parse.
 * @returns A Result containing the parsed object or an error.
 */
export function safeParse(input) {
    try {
        return { ok: true, value: JSON.parse(input) };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
}
/**
 * An internal helper function, not exported.
 */
function internalHelper() {
    return 'secret';
}
/**
 * A variable exported with a different name.
 */
const internalConfig = { timeout: 1000 };
export { internalConfig as config };
