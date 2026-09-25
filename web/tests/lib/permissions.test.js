import { describe, it, expect } from 'vitest';

import { PERMISSION_LIST, PERMISSION_REQUIRES, withDependencies } from '../../src/lib/permissions.js';
import {
  PERMISSIONS,
  PERMISSION_REQUIRES as SERVER_REQUIRES,
  withPrerequisites,
} from '../../../MPX-BACKEND-FULL-SAAS/src/config/permissions.js';

/**
 * The Staff page's permission ticks must match what the server stores. The
 * server is the authority (it re-applies prerequisites on save); these tests
 * keep the two lists from drifting apart silently.
 */
describe('permission catalogue — web matches the server', () => {
  it('offers exactly the server\'s grantable permissions, no more, no fewer', () => {
    const web = PERMISSION_LIST.map((p) => p.value).sort();
    const server = Object.values(PERMISSIONS).sort();
    expect(web).toEqual(server);
  });

  it('has the same prerequisite map as the server', () => {
    expect(PERMISSION_REQUIRES).toEqual({ ...SERVER_REQUIRES });
  });

  it('ticking any single permission gives the same set on web and server', () => {
    for (const { value } of PERMISSION_LIST) {
      const web = withDependencies([], [value]).sort();
      const server = [...withPrerequisites([value])].sort();
      expect(web, value).toEqual(server);
    }
  });
});

describe('withDependencies (Staff page ticks)', () => {
  it('ticking "Assign tickets" pulls in the whole chain', () => {
    expect(withDependencies([], ['support:assign']).sort()).toEqual(
      ['support:assign', 'support:read', 'support:view_all'].sort(),
    );
  });

  it('a reviewer permission brings "View organisations"', () => {
    for (const p of ['exporter:verify', 'buyer:approve', 'kyc:view']) {
      expect(withDependencies([], [p])).toContain('organisation:read');
    }
  });

  it('clearing a prerequisite clears everything standing on it', () => {
    const held = ['lead:manage', 'lead:view_all', 'lead:assign', 'support:read'];
    const next = held.filter((p) => p !== 'lead:manage');
    expect(withDependencies(held, next)).toEqual(['support:read']);
  });

  it('clearing a middle link keeps what is below it', () => {
    const held = ['support:read', 'support:view_all', 'support:assign'];
    const next = held.filter((p) => p !== 'support:view_all');
    expect(withDependencies(held, next)).toEqual(['support:read']);
  });

  it('never duplicates a permission', () => {
    const out = withDependencies(['support:read'], ['support:read', 'support:assign']);
    expect(out.length).toBe(new Set(out).size);
  });
});
