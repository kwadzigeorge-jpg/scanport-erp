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
  daily:           (p) => api.get('/reports/daily', { params: p }),
  dwellTime:       (p) => api.get('/reports/dwell-time', { params: p }),
  agentPerf:       (p) => api.get('/reports/agent-performance', { params: p }),
  audit:           (p) => api.get('/reports/audit', { params: p }),
  exceptions:      (p) => api.get('/reports/exceptions', { params: p }),
  config:          ()  => api.get('/reports/config'),
  updateConfig:    (d) => api.put('/reports/config', d),
  downloadDaily:   (p) => api.get('/reports/daily', { params: { ...p, format: 'xlsx' }, responseType: 'blob' }),
  downloadDwell:   (p) => api.get('/reports/dwell-time', { params: { ...p, format: 'xlsx' }, responseType: 'blob' }),
  downloadAgent:   (p) => api.get('/reports/agent-performance', { params: { ...p, format: 'xlsx' }, responseType: 'blob' }),
  downloadAudit:   (p) => api.get('/reports/audit', { params: { ...p, format: 'xlsx' }, responseType: 'blob' }),
};

export default api;
