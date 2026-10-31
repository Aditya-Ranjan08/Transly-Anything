import { useCallback, useEffect, useState } from 'react';
import fetchCapabilities from './fetchCapabilities.js';

const emptyCapabilities = { configured: false, reachable: false, languages: [], pairs: [], maxFileSize: 10 * 1024 * 1024, message: '' };

export default function useProviderCapabilities() {
  const [capabilities, setCapabilities] = useState(emptyCapabilities);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      setCapabilities(await fetchCapabilities());
    } catch (error) {
      setCapabilities({
        ...emptyCapabilities,
        configured: true,
        message: error.response?.data?.message || 'Could not check translation providers. Check the backend and database, then retry.',
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { capabilities, checking, refresh };
}
