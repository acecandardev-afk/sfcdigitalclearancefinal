/** Role strings as returned on the session (lowercase). */
export type SessionRole =
  | 'student'
  | 'employee'
  | 'signatory'
  | 'superadmin'
  | 'faculty_admin'
  | 'hr_admin';

export function hasRole(roles: string[] | undefined, role: SessionRole): boolean {
  return roles?.includes(role) ?? false;
}

export function isSuperAdmin(roles: string[] | undefined): boolean {
  return hasRole(roles, 'superadmin');
}

export function isInstitutionalStaff(roles: string[] | undefined): boolean {
  return (
    hasRole(roles, 'signatory') ||
    hasRole(roles, 'superadmin') ||
    hasRole(roles, 'employee') ||
    hasRole(roles, 'hr_admin')
  );
}
