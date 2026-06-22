import type { InstitutionalCertificationRole } from '@prisma/client';

export type CertFieldPermissions = {
  canEditPrepared: boolean;
  canEditVerified: boolean;
  canEditApproved: boolean;
};

export function getInstitutionalCertFieldPermissions(
  userId: string,
  requesterId: string,
  roles: string[],
  mySignatory: { institutionalCertRole: InstitutionalCertificationRole } | null
): CertFieldPermissions {
  const isElevated = roles.includes('superadmin') || roles.includes('hr_admin');
  const isRequester = userId === requesterId;
  const r = mySignatory?.institutionalCertRole ?? 'none';

  return {
    canEditPrepared: isElevated || isRequester || r === 'preparer',
    canEditVerified: isElevated || r === 'hrmdo',
    canEditApproved: isElevated || r === 'president',
  };
}
