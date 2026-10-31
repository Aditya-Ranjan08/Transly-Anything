import api from '../../lib/api.js';

export default async function fetchCapabilities() {
  try {
    const { data } = await api.get('/translations/capabilities');
    return data;
  } catch (error) {
    if (error.response?.status !== 401) throw error;
    // Migrate a valid older session cookie to the wider /api path, then retry once.
    await api.get('/auth/me');
    const { data } = await api.get('/translations/capabilities');
    return data;
  }
}
