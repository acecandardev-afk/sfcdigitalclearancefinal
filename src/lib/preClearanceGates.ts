import type { PreClearanceGate } from '@prisma/client';

export type PreClearanceGateId = PreClearanceGate;

export const PRE_CLEARANCE_GATES: {
  id: PreClearanceGateId;
  label: string;
  officeLabel: string;
  description: string;
}[] = [
  {
    id: 'faculty',
    label: 'Faculty office',
    officeLabel: 'Faculty Office',
    description: 'Faculty office in-person physical verification',
  },
  {
    id: 'cmo',
    label: 'CMO (Campus Ministry)',
    officeLabel: 'CMO — Campus Ministry Office',
    description: 'Sister-led campus ministry office verification',
  },
  {
    id: 'guidance',
    label: 'Guidance (Wellness Center)',
    officeLabel: 'Franciscan Wellness Center (Guidance)',
    description: 'Sister-led guidance office verification',
  },
];

export function isCmoSignatoryPosition(position: string, name: string): boolean {
  const p = position.toLowerCase();
  const n = name.toLowerCase();
  return /cmo|campus ministry/.test(p) || (/\bsr\.?\b/.test(n) && /cmo|campus ministry/.test(p));
}

export function isGuidanceSignatoryPosition(position: string, name: string): boolean {
  const p = position.toLowerCase();
  const n = name.toLowerCase();
  return /guidance|wellness center/.test(p) || (/\bsr\.?\b/.test(n) && /guidance|wellness/.test(p));
}

export function gateForSignatory(position: string, name: string): PreClearanceGateId | null {
  if (isCmoSignatoryPosition(position, name)) return 'cmo';
  if (isGuidanceSignatoryPosition(position, name)) return 'guidance';
  return null;
}

export function gateLabel(gate: PreClearanceGateId): string {
  return PRE_CLEARANCE_GATES.find((g) => g.id === gate)?.label ?? gate;
}
