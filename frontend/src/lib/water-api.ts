import axios from 'axios';
export { getErrorMessage } from './api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

/** axios ของระบบประปา — ใช้ token แยก (water_access_token) ไม่ปนกับระบบหลัก */
export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('water_access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('water_access_token');
      if (!location.pathname.endsWith('/prapa/login')) location.href = '/prapa/login';
    }
    return Promise.reject(err);
  },
);
