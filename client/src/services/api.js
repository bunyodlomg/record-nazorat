import axios from 'axios';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 12_000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use(cfg => {
  const token = localStorage.getItem('ep_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

http.interceptors.response.use(
  res => res.data,
  err => {
    // 401 — clear token. AuthContext will handle re-render to login screen.
    if (err.response?.status === 401) {
      localStorage.removeItem('ep_token');
    }
    // 202 / 403 — payload (status: pending|rejected) ham foydali, shuni o'tkazib beramiz
    const e = new Error(err.response?.data?.message || err.message);
    e.status  = err.response?.status;
    e.payload = err.response?.data;
    return Promise.reject(e);
  }
);

const api = {
  auth: {
    login:          (email, password) => http.post('/auth/login', { email, password }),
    telegram:       (initData, startParam) => http.post('/auth/telegram', { initData, startParam }),
    me:             ()                => http.get('/auth/me'),
    updateMe:       data              => http.patch('/auth/me', data),
    changePassword: data              => http.post('/auth/change-password', data),
  },
  invites: {
    list:   ()              => http.get('/invites'),
    create: data            => http.post('/invites', data),
    revoke: id              => http.patch(`/invites/${id}/revoke`),
    delete: id              => http.delete(`/invites/${id}`),
  },
  users: {
    list:    (params = {})  => http.get('/users', { params }),
    approve: (id, data = {}) => http.patch(`/users/${id}/approve`, data),
    reject:  id             => http.patch(`/users/${id}/reject`),
    delete:  id             => http.delete(`/users/${id}`),
  },
  students: {
    list:    (params = {})  => http.get('/students', { params }),
    get:     id             => http.get(`/students/${id}`),
    create:  data           => http.post('/students', data),
    update:  (id, data)     => http.patch(`/students/${id}`, data),
    delete:  id             => http.delete(`/students/${id}`),
  },
  leaderboard: {
    teachers: (params = {}) => http.get('/leaderboard/teachers', { params }),
    students: (params = {}) => http.get('/leaderboard/students', { params }),
    groups:   (params = {}) => http.get('/leaderboard/groups',   { params }),
  },
  dashboard: {
    get: () => http.get('/dashboard'),
  },
  teachers: {
    list:     (p = {}) => http.get('/teachers', { params: p }),
    stats:    ()        => http.get('/teachers/stats'),
    get:      id        => http.get(`/teachers/${id}`),
    create:   data      => http.post('/teachers', data),
    update:   (id,data) => http.patch(`/teachers/${id}`, data),
    delete:   id        => http.delete(`/teachers/${id}`),
    activity: id        => http.get(`/teachers/${id}/activity`),
    message:  (id, payload) => http.post(`/teachers/${id}/message`, payload),
  },
  groups: {
    list:   (p = {}) => http.get('/groups', { params: p }),
    get:    id        => http.get(`/groups/${id}`),
    create: data      => http.post('/groups', data),
    update: (id,data) => http.patch(`/groups/${id}`, data),
    delete: id        => http.delete(`/groups/${id}`),
  },
  notifications: {
    list: (params = {}) => http.get('/notifications', { params }),
  },
  calendar: {
    events: (from, to, teacherId) => http.get('/calendar/events', { params: { from, to, teacherId } }),
  },
  homework: {
    list:        (p = {}) => http.get('/homework', { params: p }),
    stats:       ()        => http.get('/homework/stats'),
    overdue:     ()        => http.get('/homework/overdue'),
    get:         id        => http.get(`/homework/${id}`),
    submissions: id        => http.get(`/homework/${id}/submissions`),
    create:      data      => http.post('/homework', data),
    update:      (id,data) => http.patch(`/homework/${id}`, data),
    move:        (id,col)  => http.patch(`/homework/${id}/move`, { col }),
    delete:      id        => http.delete(`/homework/${id}`),
  },
  submissions: {
    list:   (params = {})  => http.get('/submissions', { params }),
    update: (id, data)     => http.patch(`/submissions/${id}`, data),
    bulk:   (ids, status)  => http.patch('/submissions/bulk', { ids, status }),
  },
};

export default api;
