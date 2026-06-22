/**
 * Central permission matrix: superadmin, faculty_admin, hr_admin, signatory, employee, student.
 * Use these helpers in API routes instead of ad-hoc `roles.includes('superadmin')`.
 */

export function isSuperadmin(roles: string[]): boolean {
  return roles.includes('superadmin');
}

export function isFacultyAdmin(roles: string[]): boolean {
  return roles.includes('faculty_admin');
}

export function isHrAdmin(roles: string[]): boolean {
  return roles.includes('hr_admin');
}

/**
 * Users who may file or advance their own student clearance.
 * System admins (superadmin / faculty_admin / hr_admin) manage users and settings only —
 * they must not use student clearance flows even if they also have the student role.
 */
export function canRequestStudentClearance(roles: string[]): boolean {
  if (!roles.includes('student')) return false;
  if (isSuperadmin(roles) || isFacultyAdmin(roles) || isHrAdmin(roles)) return false;
  return true;
}

/**
 * File a new institutional (exit) clearance as the employee leaving.
 * Superadmin / faculty_admin / hr_admin oversee the system; they do not submit their own exit request here.
 */
export function canCreateOwnInstitutionalClearanceRequest(roles: string[]): boolean {
  if (!roles.includes('employee')) return false;
  if (isSuperadmin(roles) || isFacultyAdmin(roles) || isHrAdmin(roles)) return false;
  return true;
}

/** Student-clearance programme admins (manage users, settings — not the office signatory nav persona). */
export function isStudentClearanceElevatedAdmin(roles: string[]): boolean {
  return isSuperadmin(roles) || isFacultyAdmin(roles) || isHrAdmin(roles);
}

/** Institutional programme admins (overview, offices — separate from staff signatory queue nav). */
export function isInstitutionalElevatedAdmin(roles: string[]): boolean {
  return isSuperadmin(roles) || isFacultyAdmin(roles) || isHrAdmin(roles);
}

/**
 * Show student "To Sign" / "Signed" in the main (student platform) nav — office signatories only,
 * not elevated admins (they use admin dashboard links when they also hold a signatory role).
 */
export function showStudentSignatoryQueueInMainNav(roles: string[]): boolean {
  return roles.includes('signatory') && !isStudentClearanceElevatedAdmin(roles);
}

/**
 * Show institutional signing queue items in the institutional sidebar — staff signatories only.
 */
export function showInstitutionalSignatoryQueueInNav(roles: string[]): boolean {
  return roles.includes('signatory') && !isInstitutionalElevatedAdmin(roles);
}

/** Superadmin or HR — full institutional admin (office defs, all records, certification). */
export function isInstitutionalAdminElevation(roles: string[]): boolean {
  return isSuperadmin(roles) || isHrAdmin(roles);
}

/** Superadmin or faculty — student-side records, signatories, bulk assign, extensions review. */
export function isStudentRecordsElevation(roles: string[]): boolean {
  return isSuperadmin(roles) || isFacultyAdmin(roles);
}

/** Anyone who may review clearance period extensions. */
export function canReviewClearanceExtensions(roles: string[]): boolean {
  return isSuperadmin(roles) || isFacultyAdmin(roles) || isHrAdmin(roles);
}

export function canManageSystemSettings(roles: string[]): boolean {
  return isSuperadmin(roles);
}

export function canManageUsersList(roles: string[]): boolean {
  return isSuperadmin(roles);
}

export function canCreateUsers(roles: string[]): boolean {
  return isSuperadmin(roles);
}

export function canAssignUserRoles(roles: string[]): boolean {
  return isSuperadmin(roles);
}

export function canManageStudents(roles: string[]): boolean {
  return isSuperadmin(roles) || isFacultyAdmin(roles);
}

/** Faculty / CMO / Guidance staff — mark students physically verified before clearance. */
export function canManagePreClearanceVerification(roles: string[]): boolean {
  return isStudentRecordsElevation(roles);
}

/** Create student accounts (manual or Excel bulk). Same admins as the Students list; do not confuse with platform-wide user creation (`canCreateUsers`). */
export function canCreateStudentAccounts(roles: string[]): boolean {
  return canManageStudents(roles);
}

export function canManageBulkAssign(roles: string[]): boolean {
  return isSuperadmin(roles) || isFacultyAdmin(roles);
}

export function canManageDefaultSignatories(roles: string[]): boolean {
  return isSuperadmin(roles) || isFacultyAdmin(roles) || isHrAdmin(roles);
}

/** Create signatories, list, update fields (not delete). */
export function canWriteSignatories(roles: string[]): boolean {
  return isSuperadmin(roles) || isFacultyAdmin(roles) || isHrAdmin(roles);
}

export function canDeleteSignatory(roles: string[]): boolean {
  return isSuperadmin(roles);
}

/** Superadmin — view and restore archived students and signatories. */
export function canManageArchivedRecords(roles: string[]): boolean {
  return isSuperadmin(roles);
}

/** Superadmin — archive signatories (replaces hard delete). */
export function canArchiveSignatory(roles: string[]): boolean {
  return isSuperadmin(roles);
}

export function canManageInstitutionalOfficeDefinitions(roles: string[]): boolean {
  return isSuperadmin(roles) || isHrAdmin(roles);
}

export function canViewAdminActivityLogs(roles: string[]): boolean {
  return isSuperadmin(roles) || isFacultyAdmin(roles) || isHrAdmin(roles);
}

export function canViewAdminReports(roles: string[]): boolean {
  return isSuperadmin(roles) || isFacultyAdmin(roles) || isHrAdmin(roles);
}

export function canViewDashboardSuperadmin(roles: string[]): boolean {
  return isSuperadmin(roles) || isFacultyAdmin(roles) || isHrAdmin(roles);
}

/** Institutional app shell (employee exit clearance). */
export function canUseInstitutionalAppRoles(roles: string[]): boolean {
  return (
    roles.includes('employee') ||
    roles.includes('signatory') ||
    isSuperadmin(roles) ||
    isHrAdmin(roles)
  );
}

/** Section II / queue / certification actions (not necessarily every employee). */
export function canAccessInstitutionalStaffRoutes(roles: string[]): boolean {
  return roles.includes('signatory') || isSuperadmin(roles) || isHrAdmin(roles);
}

/**
 * In institutional platform mode we normally confine URLs to `/dashboard/institutional/*`.
 * Superadmins / faculty / HR still need selected student-clearance admin pages (signatories, students, …).
 */
export function isStudentClearanceAdminCrossModulePath(pathname: string, roles: string[]): boolean {
  if (pathname === '/dashboard/signatories') return canWriteSignatories(roles);
  if (pathname === '/dashboard/students' || pathname.startsWith('/dashboard/students/')) {
    return canManageStudents(roles);
  }
  if (pathname === '/dashboard/bulk-assign') return canManageBulkAssign(roles);
  if (pathname === '/dashboard/reports') return canViewAdminReports(roles);
  if (pathname.startsWith('/dashboard/settings')) return canManageSystemSettings(roles);
  if (pathname === '/dashboard/archived') return canManageArchivedRecords(roles);
  if (pathname === '/dashboard') return canViewDashboardSuperadmin(roles);
  return false;
}

/**
 * Student clearance signatory queue lives under `/dashboard/requests` (not institutional).
 * When the app is in institutional platform mode, these paths must still be reachable for
 * office signatories who act on student clearances.
 */
export function isSignatoryStudentClearanceCrossModulePath(pathname: string, roles: string[]): boolean {
  if (!roles.includes('signatory')) return false;
  if (pathname === '/dashboard/requests' || pathname.startsWith('/dashboard/requests/')) return true;
  if (pathname === '/dashboard/approved') return true;
  return false;
}
