/**
 * Section II: fixed clearance table for employee institutional exit.
 * Each row is created in this order; sign-off proceeds sequentially.
 */
/** Fallback when `institutional_office_definitions` is empty; keep in sync with `prisma/seed.ts`. */
export const INSTITUTIONAL_CLEARANCE_OFFICE_ROWS = [
  "Immediate Department Head — Employee's assigned department",
  'Dean / Principal — Academic Administration',
  'Human Resource Management Office Personnel — HRMDO',
  'Vice President for Administration — Administration Office',
  'Vice President for Academic Affairs — Academic Affairs Office',
  'Vice President for Student Affairs — Student Affairs Office',
  'Vice President for Finance — Finance Office',
  'Accounting / Bookkeeper — Accounting Office',
  'Disbursing Officer — Disbursing Office',
  'Canteen Personnel — Canteen',
  'Supply and Property Management Personnel — Supply and Property Management Office',
  'Librarian / Library Staff — Library',
  "Registrar Personnel — Registrar's Office",
  'ICT Personnel — ICT Office',
  'Guidance Personnel — Guidance Office',
  'Campus Ministry Personnel — Campus Ministry',
  'Chaplain / General Services Personnel — Chaplain / General Services',
  'Security Office / Head Guard — Security Office',
  'Planning and Quality Assurance Personnel — Planning and Quality Assurance Office',
  'Alumni Affairs Personnel — Alumni Affairs',
  'Dispensary Personnel — Dispensary / Health Services',
] as const;

export const EMPLOYEE_TYPE_OPTIONS = [
  { value: 'teaching', label: 'Teaching Personnel' },
  { value: 'ntp', label: 'Non-Teaching Personnel (NTP)' },
] as const;

export const REASON_CATEGORY_OPTIONS = [
  { value: 'resignation', label: 'Resignation' },
  { value: 'end_of_contract', label: 'End of Contract' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'other', label: 'Others' },
] as const;

export function staticOfficeItemCreates() {
  return INSTITUTIONAL_CLEARANCE_OFFICE_ROWS.map((label, index) => ({
    signatoryId: null as null,
    departmentLabel: label,
    sortOrder: index,
    status: 'pending' as const,
  }));
}

export function labelEmployeeType(v: string | null | undefined) {
  if (v === 'teaching') return 'Teaching Personnel';
  if (v === 'ntp') return 'Non-Teaching Personnel (NTP)';
  return v || '—';
}

export function labelReasonCategory(v: string | null | undefined) {
  const o = REASON_CATEGORY_OPTIONS.find((r) => r.value === v);
  return o?.label ?? v ?? '—';
}
