import { useCallback, useEffect, useState } from 'react';
import { parseClearancePeriodFromSettings, type ClearancePeriod } from '@/lib/clearancePeriod';

export function useClearancePeriodSettings() {
  const [period, setPeriod] = useState<ClearancePeriod | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/clearance-window', { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      const json = await res.json();
      setPeriod(parseClearancePeriodFromSettings(json.value_json));
    } catch (e) {
      console.error(e);
      setPeriod(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { period, loading, configured: period !== null, reload };
}
