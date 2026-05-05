import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// Attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (err.response?.status === 403) {
      toast.error('Access denied: insufficient permissions.');
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login:           (data)  => api.post('/auth/login', data),
  logout:          ()      => api.post('/auth/logout'),
  me:              ()      => api.get('/auth/me'),
  forgotPassword:  (data)  => api.post('/auth/forgot-password', data),
  resetPassword:   (data)  => api.post('/auth/reset-password', data),
  changePassword:  (data)  => api.post('/auth/change-password', data),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list:             (params) => api.get('/users', { params }),
  get:              (id)     => api.get(`/users/${id}`),
  create:           (data)   => api.post('/users', data),
  update:           (id, d)  => api.put(`/users/${id}`, d),
  resetPassword:    (id, d)  => api.post(`/users/${id}/reset-password`, d),
  unlock:           (id)     => api.post(`/users/${id}/unlock`),
  killSessions:     (id)     => api.delete(`/users/${id}/sessions`),
  roles:            ()       => api.get('/users/roles'),
  permissions:      ()       => api.get('/users/permissions'),
  stats:            ()       => api.get('/users/stats'),
  sessions:         ()       => api.get('/users/sessions'),
  killSession:      (sid)    => api.delete(`/users/sessions/${sid}`),
};

// ─── Containers ───────────────────────────────────────────────────────────────
export const containersApi = {
  // Booth Officer
  checkIn:             (data)   => api.post('/containers/check-in', data),
  assignBay:           (id, d)  => api.post(`/containers/${id}/assign-bay`, d),
  allocate:            (data)   => api.post('/containers/allocate', data),   // legacy one-step

  // Marshal workflow
  confirmEntry:        (data)   => api.post('/containers/confirm-entry', data),
  startExamination:    (id, d)  => api.post(`/containers/${id}/start-examination`, d),
  completeExamination: (id, d)  => api.post(`/containers/${id}/complete-examination`, d),
  confirmExit:         (data)   => api.post('/containers/confirm-exit', data),

  // CRUD
  list:          (params) => api.get('/containers', { params }),
  get:           (id)     => api.get(`/containers/${id}`),
  override:      (id, d)  => api.put(`/containers/${id}/override`, d),
  reinstate:     (id, d)  => api.post(`/containers/${id}/reinstate`, d),

  // Reference
  holdingAreas:  ()       => api.get('/containers/holding-areas'),
  baysView:      (params) => api.get('/containers/bays-view', { params }),
  statusSummary: ()       => api.get('/containers/status-summary'),
};

// ─── Trucks ───────────────────────────────────────────────────────────────────
export const trucksApi = {
  create:         (data)   => api.post('/trucks', data),
  list:           (params) => api.get('/trucks', { params }),
  release:        (id, d)  => api.post(`/trucks/${id}/release`, d),
  availableBays:  (params) => api.get('/trucks/bays', { params }),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  summary:    () => api.get('/dashboard/summary'),
  overstayed: () => api.get('/dashboard/overstayed'),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  // New analytics
  operationsDashboard: (p) => api.get('/reports/operations-dashboard', { params: p }),
  dwellAnalysis:       (p) => api.get('/reports/dwell-analysis', { params: p }),
  areaPerformance:     (p) => api.get('/reports/area-performance', { params: p }),
  agentPerf:           (p) => api.get('/reports/agent-performance', { params: p }),
  slaExceptions:       (p) => api.get('/reports/sla-exceptions', { params: p }),
  export:              (p) => api.get('/reports/export', { params: p, responseType: 'blob' }),

  // Email & alerts
  emailConfig:       ()  => api.get('/reports/email-config'),
  updateEmailConfig: (d) => api.put('/reports/email-config', d),
  testEmail:         (d) => api.post('/reports/test-email', d),

  // Legacy
  daily:           (p) => api.get('/reports/daily', { params: p }),
  dwellTime:       (p) => api.get('/reports/dwell-time', { params: p }),
  audit:           (p) => api.get('/reports/audit', { params: p }),
  exceptions:      (p) => api.get('/reports/exceptions', { params: p }),
  config:          ()  => api.get('/reports/config'),
  updateConfig:    (d) => api.put('/reports/config', d),
  downloadDaily:   (p) => api.get('/reports/daily', { params: { ...p, format: 'xlsx' }, responseType: 'blob' }),
  downloadDwell:   (p) => api.get('/reports/dwell-time', { params: { ...p, format: 'xlsx' }, responseType: 'blob' }),
  downloadAgent:   (p) => api.get('/reports/agent-performance', { params: { ...p, format: 'xlsx' }, responseType: 'blob' }),
  downloadAudit:   (p) => api.get('/reports/audit', { params: { ...p, format: 'xlsx' }, responseType: 'blob' }),
};

// ─── Leave Management ─────────────────────────────────────────────────────────
export const leaveApi = {
  overview:      ()         => api.get('/leave/overview'),
  requests:      (p)        => api.get('/leave/requests', { params: p }),
  submit:        (d)        => api.post('/leave/requests', d),
  approve:       (id)       => api.put(`/leave/requests/${id}/approve`),
  reject:        (id, d)    => api.put(`/leave/requests/${id}/reject`, d),
  deleteReq:     (id)       => api.delete(`/leave/requests/${id}`),
  balances:      (p)        => api.get('/leave/balances', { params: p }),
  departments:   ()         => api.get('/leave/departments'),
  createDept:    (d)        => api.post('/leave/departments', d),
  deleteDept:    (id)       => api.delete(`/leave/departments/${id}`),
  addTeam:       (dId, d)   => api.post(`/leave/departments/${dId}/teams`, d),
  deleteTeam:    (dId, tId) => api.delete(`/leave/departments/${dId}/teams/${tId}`),
  staff:         (p)        => api.get('/leave/staff', { params: p }),
  addStaff:      (d)        => api.post('/leave/staff', d),
  updateStaff:   (id, d)    => api.put(`/leave/staff/${id}`, d),
  removeStaff:   (id)       => api.delete(`/leave/staff/${id}`),
  replaceRoster: (tid, d)   => api.post(`/leave/teams/${tid}/replace-roster`, d),
  holidays:      ()         => api.get('/leave/holidays'),
  addHoliday:    (d)        => api.post('/leave/holidays', d),
  deleteHoliday: (id)       => api.delete(`/leave/holidays/${id}`),
};

// ─── Permissions & Roles (RBAC) ───────────────────────────────────────────────
export const permissionsApi = {
  listAtomic:          ()          => api.get('/permissions/atomic'),
  listGroups:          ()          => api.get('/permissions/groups'),
  createGroup:         (d)         => api.post('/permissions/groups', d),
  updateGroup:         (id, d)     => api.put(`/permissions/groups/${id}`, d),
  deleteGroup:         (id)        => api.delete(`/permissions/groups/${id}`),
  listRoles:           ()          => api.get('/permissions/roles'),
  getRole:             (id)        => api.get(`/permissions/roles/${id}`),
  createRole:          (d)         => api.post('/permissions/roles', d),
  updateRole:          (id, d)     => api.put(`/permissions/roles/${id}`, d),
  deleteRole:          (id)        => api.delete(`/permissions/roles/${id}`),
  getRoleHistory:      (id)        => api.get(`/permissions/roles/${id}/history`),
  getUserOverrides:    (uid)       => api.get(`/permissions/users/${uid}/overrides`),
  setUserOverride:     (uid, d)    => api.put(`/permissions/users/${uid}/overrides`, d),
  removeUserOverride:  (uid, oid)  => api.delete(`/permissions/users/${uid}/overrides/${oid}`),
  getUserEffective:    (uid)       => api.get(`/permissions/users/${uid}/effective`),
};

export default api;
