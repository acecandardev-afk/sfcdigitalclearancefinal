import { useEffect, useState } from 'react';

export type MeProfile = {
  full_name: string;
  year_level: string;
  course: string;
  student_id: string;
};

export function useMeProfile(enabled: boolean) {
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me/profile', { credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error('failed');
        const p = json.profile as Record<string, unknown> | undefined;
        if (!cancelled && p) {
          setProfile({
            full_name: String(p.full_name ?? ''),
            year_level: String(p.year_level ?? ''),
            course: String(p.course ?? ''),
            student_id: String(p.student_id ?? ''),
          });
        }
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { profile, loading };
}
