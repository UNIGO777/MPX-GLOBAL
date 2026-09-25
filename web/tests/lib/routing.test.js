import { describe, it, expect, afterEach } from 'vitest';

import { cp, consoleBaseFor } from '../../src/lib/consolePath.js';
import { can, isStaff, roleHome } from '../../src/auth/roleHome.js';

const at = (path) => window.history.pushState({}, '', path);
afterEach(() => at('/'));

describe('cp() — console links follow the console you are in', () => {
  it('keeps /admin links inside the admin console', () => {
    at('/admin/dashboard');
    expect(cp('/admin/support/1')).toBe('/admin/support/1');
  });

  it('rewrites /admin links to /staff inside the staff console', () => {
    at('/staff/dashboard');
    expect(cp('/admin/support/1')).toBe('/staff/support/1');
    expect(cp('/admin/leads?view=new')).toBe('/staff/leads?view=new');
    expect(cp('/admin')).toBe('/staff');
  });

  it('leaves other paths, and look-alike prefixes, alone', () => {
    at('/staff/dashboard');
    expect(cp('/buyer/support')).toBe('/buyer/support');
    expect(cp('/administration')).toBe('/administration');
    expect(cp(undefined)).toBeUndefined();
  });

  it('super admin → /admin, everyone else → /staff', () => {
    expect(consoleBaseFor('superadmin')).toBe('/admin');
    expect(consoleBaseFor('employee')).toBe('/staff');
  });
});

describe('roleHome / can — where people land and what the UI shows', () => {
  it('lands each role on its own home', () => {
    expect(roleHome(null)).toBe('/signin');
    expect(roleHome({ role: 'buyer' })).toBe('/buyer/verification');
    expect(roleHome({ role: 'exporter' })).toBe('/exporter/dashboard');
    expect(roleHome({ role: 'superadmin' })).toBe('/admin/dashboard');
    expect(roleHome({ role: 'employee' })).toBe('/staff/dashboard');
    expect(roleHome({ role: 'admin' })).toBe('/signin'); // there is no admin role
  });

  it('can(): super admin holds everything; an employee only what was granted', () => {
    expect(can({ role: 'superadmin' }, 'anything')).toBe(true);
    const asha = { role: 'employee', permissions: ['support:read'] };
    expect(can(asha, 'support:read')).toBe(true);
    expect(can(asha, 'support:view_all')).toBe(false);
    expect(can(asha, 'lead:manage', 'support:read')).toBe(true); // any-of
    expect(can(null, 'support:read')).toBe(false);
    expect(can({ role: 'employee' }, 'support:read')).toBe(false);
  });

  it('isStaff is employee or super admin only', () => {
    expect(isStaff({ role: 'employee' })).toBe(true);
    expect(isStaff({ role: 'superadmin' })).toBe(true);
    expect(isStaff({ role: 'exporter' })).toBe(false);
  });
});
