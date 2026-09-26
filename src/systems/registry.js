/**
 * Her-Story — systems registry.
 *
 * Systems refer to each other through this object instead of importing one
 * another directly. That keeps the dependency graph acyclic (evidence can reveal
 * a person, a person can reference evidence) and makes it trivial to stub a
 * system in tests.
 */

export const systems = {};
export default systems;
