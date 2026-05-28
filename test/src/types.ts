/**
 * A simple user interface.
 */
export interface User {
  /** The user's unique identifier. */
  id: string;
  /** The user's full name. */
  name: string;
  /** The user's role. */
  role: Role;
}

/**
 * Defines the possible roles for a user.
 */
export enum Role {
  Admin = 'ADMIN',
  Member = 'MEMBER',
  Guest = 'GUEST',
}

/**
 * A type alias for a string or number ID.
 */
export type ID = string | number;

/**
 * A generic result type.
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
