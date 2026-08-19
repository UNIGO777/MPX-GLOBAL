import { apiClient } from './client.js';

/**
 * Staff console endpoints. Permission gates are the server's
 * (user:read · organisation:read · buyer:approve · exporter:verify · kyc:view ·
 * superadmin hard gates) — the UI only hides what a 403 would refuse anyway.
 */
export const adminApi = {
  // --- user directory (user:read) -------------------------------------------
  listUsers: (params) => apiClient.get('/admin/users', { params }).then((r) => r.data),
  getUser: (id) => apiClient.get(`/admin/users/${id}`).then((r) => r.data.user),
  // superadmin-only hard gates
  activateUser: (id) => apiClient.post(`/admin/users/${id}/activate`).then((r) => r.data.user),
  deactivateUser: (id) => apiClient.post(`/admin/users/${id}/deactivate`).then((r) => r.data.user),

  /**
   * M5 §5 — the dashboard. NO permission of its own: the server builds only the
   * tiles the caller already holds the permission for, so a tile can never link
   * an employee to a list they cannot open.
   */
  dashboard: (params) => apiClient.get('/admin/dashboard', { params }).then((r) => r.data),

  // --- organisations (organisation:read) — the org-centric verification queue
  listOrgs: (params) => apiClient.get('/admin/orgs', { params }).then((r) => r.data),
  getOrg: (id) => apiClient.get(`/admin/orgs/${id}`).then((r) => r.data.organisation),

  /**
   * F1-A · take a whole COMPANY offline, or bring it back.
   *
   * 🔴 Hard superadmin gate on the server (`requireRole('superadmin')`), never a
   * grantable employee permission — an employee able to take a company offline
   * is a privilege-escalation path. The screen hides the control for anyone
   * else; that is presentation, and the server refuses regardless.
   *
   * It cascades: every user of the org is signed out and cannot log back in, the
   * catalogue goes dark, and every conversation the org is party to freezes with
   * a system notice. `reason` is required to block (3–500) and optional to
   * unblock — the reversal explains itself, the decision is the record.
   */
  blockOrg: (id, reason) => apiClient.post(`/admin/orgs/${id}/block`, { reason }).then((r) => r.data),
  unblockOrg: (id, reason) =>
    apiClient.post(`/admin/orgs/${id}/unblock`, reason ? { reason } : {}).then((r) => r.data),

  // --- verification decisions (:id is the ORG id) ---------------------------
  approveBuyer: (orgId) => apiClient.post(`/employee/buyers/${orgId}/approve`).then((r) => r.data.organisation),
  rejectBuyer: (orgId, reason) =>
    apiClient.post(`/employee/buyers/${orgId}/reject`, { reason }).then((r) => r.data.organisation),
  verifyExporter: (orgId) =>
    apiClient.post(`/employee/exporters/${orgId}/verify`).then((r) => r.data.organisation),
  rejectExporter: (orgId, reason) =>
    apiClient.post(`/employee/exporters/${orgId}/reject`, { reason }).then((r) => r.data.organisation),

  // --- KYC document viewer (kyc:view; signed URLs live ~120s) ---------------
  orgKycDocuments: (orgId) => apiClient.get(`/employee/orgs/${orgId}/kyc/documents`).then((r) => r.data),

  // --- employees (superadmin hard gates) ------------------------------------
  createEmployee: (payload) => apiClient.post('/admin/employees', payload).then((r) => r.data.user),
  setEmployeePermissions: (id, permissions) =>
    apiClient.patch(`/admin/employees/${id}/permissions`, { permissions }).then((r) => r.data.user),
};
