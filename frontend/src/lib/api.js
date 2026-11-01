import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() || '/api';
const trimmedApiUrl = configuredApiUrl.replace(/\/+$/, '');
const apiBaseUrl = /\/api$/i.test(trimmedApiUrl) ? trimmedApiUrl : `${trimmedApiUrl}/api`;

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export default api;
