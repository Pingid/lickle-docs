import { User, Role } from './types';

/**
 * Represents a service for managing users.
 */
export class UserService {
  private users: Map<string, User> = new Map();

  /**
   * Creates a new user.
   * @param name The user's name.
   * @param role The user's role.
   */
  public createUser(name: string, role: Role = Role.Member): User {
    const id = Math.random().toString(36).slice(2);
    const user = { id, name, role };
    this.users.set(id, user);
    return user;
  }

  /**
   * Retrieves a user by ID.
   */
  public getUser(id: string): User | undefined {
    return this.users.get(id);
  }
}
