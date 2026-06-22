import { useEffect, useState } from 'react';

/** Whether the current user may open the physical verification staff page. */
export function usePreClearanceNavAccess(enabled: boolean) {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHasAccess(false);
      return;
    }
    let cancelled = false;
    void fetch('/api/admin/pre-clearance', { credentials: 'include' })
      .then((res) => {
        if (!cancelled) setHasAccess(res.ok);
      })
      .catch(() => {
        if (!cancelled) setHasAccess(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return hasAccess;
}
