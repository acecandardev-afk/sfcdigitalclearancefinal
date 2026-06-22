import type { Session } from 'next-auth';
import {
  canAccessInstitutionalStaffRoutes,
  canUseInstitutionalAppRoles,
} from '@/lib/permissionsMatrix';

export function sessionRoles(session: Session | null): string[] {
  return ((session?.user as { roles?: string[] } | undefined)?.roles ?? []) as string[];
}

export function isPureStudent(roles: string[]) {
  return (
    roles.includes('student') &&
    !roles.includes('superadmin') &&
    !roles.includes('signatory') &&
    !roles.includes('employee') &&
    !roles.includes('faculty_admin') &&
    !roles.includes('hr_admin')
  );
}

/** Signatory / superadmin / hr_admin — institutional signing & certification routes. */
export function canAccessInstitutionalModule(roles: string[]) {
  return canAccessInstitutionalStaffRoutes(roles);
}

/**
 * User type that may use institutional (employee) clearance UI/API shell.
 * Includes hr_admin for HR oversight without necessarily being an "employee" requester.
 */
export function canUseInstitutionalApp(roles: string[]) {
  return canUseInstitutionalAppRoles(roles);
}
