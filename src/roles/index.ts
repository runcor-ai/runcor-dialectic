// Role registry — supports canonical, inter-agent, multi-critic, and custom role-sets.

import type { RoleConfig, RoleRegistry, RoleSet } from '../types.js';

class Registry implements RoleRegistry {
  private roles = new Map<string, RoleConfig>();
  private sets = new Map<string, RoleSet>();

  registerRole(name: string, config: Omit<RoleConfig, 'role'>): void {
    this.roles.set(name, { role: name, ...config });
  }

  getRole(name: string): RoleConfig | undefined {
    return this.roles.get(name);
  }

  registerRoleSet(set: RoleSet): void {
    this.sets.set(set.name, set);
    // Also register the individual roles for direct lookup.
    for (const [roleName, cfg] of Object.entries(set.roles)) {
      if (!this.roles.has(roleName)) {
        this.roles.set(roleName, cfg);
      }
    }
  }

  getRoleSet(name: string): RoleSet | undefined {
    return this.sets.get(name);
  }

  listRoleSets(): string[] {
    return Array.from(this.sets.keys());
  }
}

export const roleRegistry: RoleRegistry = new Registry();

export function registerRole(name: string, config: Omit<RoleConfig, 'role'>): void {
  roleRegistry.registerRole(name, config);
}

export function registerRoleSet(set: RoleSet): void {
  roleRegistry.registerRoleSet(set);
}

export function getRoleSet(name: string): RoleSet | undefined {
  return roleRegistry.getRoleSet(name);
}
