/**
 * User-facing terminology for the system.
 * Formal terms used consistently across the application.
 */

export const TERMS = {
  // Status labels
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  APPROVED: 'Completed',
  REJECTED: 'Rejected',

  // Roles (display)
  SIGNATORY: 'Signatory',
  SIGNATORIES: 'Signatories',
  SUPERADMIN: 'Administrator',

  // Navigation
  MY_REQUESTS: 'My Requests',
  TO_SIGN: 'To Sign',
  COMPLETED: 'Completed',
  SIGNED: 'Signed',

  // Actions
  NEW_REQUEST: 'New Request',
  ADD_SIGNATORY: 'Add Signatory',
  MANAGE_SIGNATORIES: 'Manage Signatories',
  SET_SIGNATORY_ORDER: 'Set Signatory Order',

  // Dashboard stats
  INCOMPLETE: 'Incomplete',
  TOTAL_REQUESTS: 'Total Requests',
  COMPLETED_REQUESTS: 'Completed Requests',

  // Descriptions
  PENDING_DESC: 'Requests pending first signatory',
  COMPLETED_DESC: 'Requests signed by all signatories',
  INCOMPLETE_DESC: 'Students with no completed request',
  COMPLETED_STUDENTS_DESC: 'Students with at least one completed request',
} as const;

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return TERMS.PENDING;
    case 'in_progress':
      return TERMS.IN_PROGRESS;
    case 'approved':
      return TERMS.APPROVED;
    case 'rejected':
      return TERMS.REJECTED;
    case 'all':
      return 'All';
    default:
      return status;
  }
}
