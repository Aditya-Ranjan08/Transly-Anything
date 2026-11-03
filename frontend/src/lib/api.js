import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const selectedApiUrl = import.meta.env.PROD ? '/api' : configuredApiUrl || '/api';
const trimmedApiUrl = selectedApiUrl.replace(/\/+$/, '');
const apiBaseUrl = /\/api$/i.test(trimmedApiUrl) ? trimmedApiUrl : `${trimmedApiUrl}/api`;

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 15000,
});

export default api;
