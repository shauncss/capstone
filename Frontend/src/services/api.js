import axios from 'axios';

const DEFAULT_API_BASE = 'http://localhost:5000/api';
const DEV_API_PORT = import.meta.env.VITE_API_PORT || '5000';

function shouldUseEnvUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
    const hostIsLoopback = ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
    if (typeof window === 'undefined') {
      return true;
    }
    const runtimeHostIsLoopback = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (hostIsLoopback && !runtimeHostIsLoopback) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

function resolveApiBaseUrl() {
  if (shouldUseEnvUrl(import.meta.env.VITE_API_BASE_URL)) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE;
  }

  const { protocol, hostname, port } = window.location;
  const sameOriginBase = `${protocol}//${hostname}${port ? `:${port}` : ''}/api`;

  if (!port || port === '80' || port === '443' || port === DEV_API_PORT) {
    return sameOriginBase;
  }

  return `${protocol}//${hostname}:${DEV_API_PORT}/api`;
}

const api = axios.create({
  baseURL: resolveApiBaseUrl()
});

export const submitCheckIn = (payload) => api.post('/checkin', payload);
export const fetchQueue = () => api.get('/queue/current');
export const fetchEta = () => api.get('/waittime/estimate');
export const fetchRooms = () => api.get('/rooms');
export const addRoom = (payload) => api.post('/rooms/add', payload);
export const assignRoom = (payload) => api.post('/rooms/assign', payload);
export const finishRoom = (payload) => api.post('/rooms/finish', payload);
export const autoAssignNext = () => api.post('/rooms/auto-assign');
export const updateRoom = (roomId, payload) => api.patch(`/rooms/${roomId}`, payload);
export const deleteRoom = (roomId) => api.delete(`/rooms/${roomId}`);
export const fetchHistory = (params) => api.get('/queue/history', { params });
export const sendHeartbeat = (payload) => api.post('/pi/heartbeat', payload);
export const fetchPharmacyQueue = () => api.get('/pharmacy/queue');
export const callNextPharmacyPatient = () => api.post('/pharmacy/call-next');
export const completePharmacyPatient = (payload) => api.post('/pharmacy/complete', payload);
export const adminLogin = (payload) => api.post('/admin/login', payload);

export default api;
