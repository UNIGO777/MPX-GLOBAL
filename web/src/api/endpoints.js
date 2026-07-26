// Endpoint functions, grouped by domain (auth, catalogue, chat, verification, ...).
// Keep them thin: call `apiClient` and return the data. No implementations yet — add each
// group as its module is built.
//
// Shape to follow (example only — do not enable):
//
//   import { apiClient } from './client.js';
//   export const authApi = {
//     login: (payload) => apiClient.post('/auth/login', payload).then((r) => r.data),
//   };

export {};
