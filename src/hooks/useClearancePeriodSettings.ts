import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseClearancePeriodFromSettings, type ClearancePeriod } from '@/lib/clearancePeriod';

export function useClearancePeriodSettings() {
  const [period, setPeriod] = useState<ClearancePeriod | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const sb: typeof supabase & { from: (table: string) => any } = supabase as any;
      const { data, error } = await sb
        .from('system_settings')
        .select('value_json')
        .eq('key', 'clearance')
        .maybeSingle();
      if (error) throw error;
      setPeriod(parseClearancePeriodFromSettings(data?.value_json));
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
