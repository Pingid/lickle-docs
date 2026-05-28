/**
 * A namespace containing math utilities.
 */
export namespace MathUtils {
  /** Adds two numbers. */
  export function add(a: number, b: number): number {
    return a + b;
  }

  /** Subtracts two numbers. */
  export function subtract(a: number, b: number): number {
    return a - b;
  }

  /** A nested namespace. */
  export namespace Advanced {
    export function power(base: number, exponent: number): number {
      return Math.pow(base, exponent);
    }
  }
}
