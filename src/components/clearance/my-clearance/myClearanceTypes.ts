import type { OfficeRequirement } from './OfficeRequestModal';

export type UiStepStatus = 'Request' | 'Pending' | 'Approved' | 'Rejected';

export interface UiStepRow {
  id: string;
  signatoryId: string;
  sequenceOrder: number;
  /** Broad form section (e.g. Student & Academic Leadership). */
  department?: string;
  office: string;
  officer: string;
  uiStatus: UiStepStatus;
  date: string;
  schedule: string;
  remarks: string;
  requirements: OfficeRequirement[];
  hasDbRequirements?: boolean;
  officeVerificationPending?: boolean;
  signatureId: string | null;
  signatoryGroup: 'standard' | 'authority';
  authoritySequenceOrder: number | null;
  /** ISO timestamps for history / timeline */
  signatureCreatedAt?: string | null;
  signatureSignedAt?: string | null;
}

export const DEFAULT_REQUIREMENTS: OfficeRequirement[] = [
  { id: 1, label: 'I confirm I have completed the requirements for this office', type: 'checkbox' },
  { id: 2, label: 'Supporting document (PDF or image)', type: 'document' },
];

export function parseRequirements(raw: unknown): OfficeRequirement[] {
  if (!raw || !Array.isArray(raw)) return DEFAULT_REQUIREMENTS;
  const out: OfficeRequirement[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'number' ? o.id : Number(o.id);
    const label = typeof o.label === 'string' ? o.label : '';
    const type =
      o.type === 'document' || o.type === 'checkbox' || o.type === 'office' ? o.type : 'checkbox';
    if (!Number.isFinite(id) || !label) continue;
    const instructions = typeof o.instructions === 'string' ? o.instructions : undefined;
    const required = typeof o.required === 'boolean' ? o.required : true;
    out.push({ id, label, type, instructions, required });
  }
  return out.length ? out : DEFAULT_REQUIREMENTS;
}
