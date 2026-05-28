import { Role } from './types';
/**
 * Represents a service for managing users.
 */
export class UserService {
    users = new Map();
    /**
     * Creates a new user.
     * @param name The user's name.
     * @param role The user's role.
     */
    createUser(name, role = Role.Member) {
        const id = Math.random().toString(36).slice(2);
        const user = { id, name, role };
        this.users.set(id, user);
        return user;
    }
    /**
     * Retrieves a user by ID.
     */
    getUser(id) {
        return this.users.get(id);
    }
}
