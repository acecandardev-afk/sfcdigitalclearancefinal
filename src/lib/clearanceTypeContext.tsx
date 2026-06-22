'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { canUseInstitutionalAppRoles } from '@/lib/permissionsMatrix';

const STORAGE_KEY = 'clearance_type';

export type ClearanceModule = 'student' | 'institutional';

type Ctx = {
  /** null before hydration, or (employee paths) before first choice; students default to `student` after hydration */
  clearanceModule: ClearanceModule | null;
  isHydrated: boolean;
  setClearanceModule: (v: ClearanceModule) => void;
  clearModule: () => void;
  needsModuleSelection: boolean;
};

const ClearanceTypeContext = createContext<Ctx | null>(null);

function readStoredClearanceModule(): ClearanceModule | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw === 'student' || raw === 'institutional') return raw;
  return null;
}

export function ClearanceTypeProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const { roles, loading: roleLoading } = useUserRole();
  const [mod, setMod] = useState<ClearanceModule | null>(() => readStoredClearanceModule());
  const [isHydrated, setIsHydrated] = useState(false);

  const loading = authLoading || roleLoading;

  const institutionalUser = useMemo(() => canUseInstitutionalAppRoles(roles), [roles]);
  const rolesKey = roles.join('|');

  useEffect(() => {
    if (!userId && !authLoading && typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
      setMod((prev) => (prev === null ? prev : null));
    }
    if (typeof window === 'undefined' || !userId) {
      if (!userId && !authLoading) setIsHydrated(true);
      return;
    }
    const isStudentRole = roles.includes('student');
    const isStudentWithoutInstitutional = isStudentRole && !institutionalUser;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    setMod((prev) => {
      let next: ClearanceModule | null;
      if (raw === 'institutional' && isStudentWithoutInstitutional) {
        sessionStorage.setItem(STORAGE_KEY, 'student');
        next = 'student';
      } else if (raw === 'student' || raw === 'institutional') {
        next = raw;
      } else {
        next = null;
      }
      return next === prev ? prev : next;
    });
    setIsHydrated(true);
  }, [userId, authLoading, rolesKey, institutionalUser]);

  // First visit: student-only accounts default to the student platform (no institutional)
  useEffect(() => {
    if (!isHydrated || loading || !userId) return;
    if (mod !== null) return;
    const isStudentRole = roles.includes('student');
    const isStudentWithoutInstitutional = isStudentRole && !institutionalUser;
    if (isStudentWithoutInstitutional) {
      sessionStorage.setItem(STORAGE_KEY, 'student');
      setMod('student');
    }
  }, [isHydrated, loading, userId, institutionalUser, mod, rolesKey]);

  const setClearanceModule = useCallback(
    (v: ClearanceModule) => {
      const next: ClearanceModule = !institutionalUser && v === 'institutional' ? 'student' : v;
      sessionStorage.setItem(STORAGE_KEY, next);
      setMod(next);
      fetch('/api/me/clearance-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value: next }),
      }).catch(() => {
        /* optional cookie sync */
      });
    },
    [institutionalUser]
  );

  const clearModule = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setMod(null);
    fetch('/api/me/clearance-type', { method: 'DELETE', credentials: 'include' }).catch(() => {});
  }, []);

  const needsModuleSelection = useMemo(() => {
    if (!isHydrated || loading || !userId) return false;
    if (!institutionalUser) return false;
    return mod === null;
  }, [isHydrated, loading, userId, institutionalUser, mod]);

  const value = useMemo(
    () => ({
      clearanceModule: mod,
      isHydrated,
      setClearanceModule,
      clearModule,
      needsModuleSelection,
    }),
    [mod, isHydrated, setClearanceModule, clearModule, needsModuleSelection]
  );

  return <ClearanceTypeContext.Provider value={value}>{children}</ClearanceTypeContext.Provider>;
}

export function useClearanceType() {
  const c = useContext(ClearanceTypeContext);
  if (!c) {
    throw new Error('useClearanceType must be used within ClearanceTypeProvider');
  }
  return c;
}
