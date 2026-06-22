import type { PreClearanceGate } from '@prisma/client';
import { prisma } from '@/server/db';
import {
  PRE_CLEARANCE_GATES,
  gateForSignatory,
  gateLabel,
  type PreClearanceGateId,
} from '@/lib/preClearanceGates';
import { isFacultyAdmin, isStudentRecordsElevation, isSuperadmin } from '@/lib/permissionsMatrix';

export type PreClearanceGateStatus = {
  gate: PreClearanceGateId;
  label: string;
  officeLabel: string;
  description: string;
  verified: boolean;
  verifiedAt: string | null;
  verifiedByName: string | null;
};

export type StudentPreClearanceStatus = {
  gates: PreClearanceGateStatus[];
  allComplete: boolean;
  missingGates: PreClearanceGateId[];
};

export async function getStudentPreClearanceStatus(studentId: string): Promise<StudentPreClearanceStatus> {
  const rows = await prisma.studentPreClearanceVerification.findMany({
    where: { studentId },
    include: {
      verifiedBy: { include: { profile: true } },
    },
  });
  const byGate = new Map(rows.map((r) => [r.gate, r]));

  const gates: PreClearanceGateStatus[] = PRE_CLEARANCE_GATES.map((def) => {
    const row = byGate.get(def.id);
    return {
      gate: def.id,
      label: def.label,
      officeLabel: def.officeLabel,
      description: def.description,
      verified: !!row,
      verifiedAt: row?.verifiedAt.toISOString() ?? null,
      verifiedByName: row?.verifiedBy.profile?.fullName ?? row?.verifiedBy.email ?? null,
    };
  });

  const missingGates = gates.filter((g) => !g.verified).map((g) => g.gate);
  return {
    gates,
    allComplete: missingGates.length === 0,
    missingGates,
  };
}

export function preClearanceBlockMessage(missingGates: PreClearanceGateId[]): string {
  if (!missingGates.length) return '';
  const names = missingGates.map((g) => gateLabel(g)).join(', ');
  return `Visit these offices in person first and have staff mark you verified: ${names}.`;
}

export async function gatesUserMayVerify(
  userId: string,
  roles: string[]
): Promise<PreClearanceGate[]> {
  const allowed = new Set<PreClearanceGate>();

  if (isSuperadmin(roles) || isFacultyAdmin(roles)) {
    for (const g of PRE_CLEARANCE_GATES) allowed.add(g.id);
  }

  const signatory = await prisma.signatory.findFirst({
    where: { userId, isActive: true, isArchived: false },
    select: { position: true, name: true },
  });
  if (signatory) {
    const gate = gateForSignatory(signatory.position, signatory.name);
    if (gate) allowed.add(gate);
  }

  return [...allowed];
}

export function canAccessPreClearanceVerificationPage(roles: string[]): boolean {
  return isStudentRecordsElevation(roles);
}

export async function userHasPreClearanceVerificationAccess(
  userId: string,
  roles: string[]
): Promise<boolean> {
  if (canAccessPreClearanceVerificationPage(roles)) return true;
  const gates = await gatesUserMayVerify(userId, roles);
  return gates.length > 0;
}

export async function canUserVerifyGate(
  userId: string,
  roles: string[],
  gate: PreClearanceGate
): Promise<boolean> {
  const allowed = await gatesUserMayVerify(userId, roles);
  return allowed.includes(gate);
}
