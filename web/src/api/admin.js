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

  // --- organisations (organisation:read) — the org-centric verification queue
  listOrgs: (params) => apiClient.get('/admin/orgs', { params }).then((r) => r.data),
  getOrg: (id) => apiClient.get(`/admin/orgs/${id}`).then((r) => r.data.organisation),

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
