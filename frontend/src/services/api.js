import axios from 'axios';

let navigateToLogin = null;

export function setNavigateToLogin(fn) {
  navigateToLogin = fn;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jcopsip_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('jcopsip_token');
      localStorage.removeItem('jcopsip_user');
      if (navigateToLogin) {
        navigateToLogin();
      } else if (window.location.pathname !== '/login' && window.location.pathname !== '/admin/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  check: () => api.get('/auth/check'),
  logout: () => api.post('/auth/logout'),
};

export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  timeline: () => api.get('/dashboard/timeline'),
};

export const linesApi = {
  list: (search = '', page = 1) => api.get(`/lines?search=${encodeURIComponent(search)}&page=${page}`),
  get: (id) => api.get(`/lines/${id}`),
  create: (data) => api.post('/lines', data),
  quickCreate: () => api.post('/lines/quick-create'),
  update: (id, data) => api.put(`/lines/${id}`, data),
  delete: (id) => api.delete(`/lines/${id}`),
  sync: () => api.post('/sync'),
  sipLines: () => api.get('/sip-lines'),
};

export const adminApi = {
  listUsers: () => api.get('/admin/users'),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  changePassword: (id, password) => api.put(`/admin/users/${id}/password`, { password }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  logs: (page = 1) => api.get(`/admin/logs?page=${page}`),
};

export default api;
