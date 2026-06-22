import type { RequirementKind } from '@prisma/client';

export function requirementToOfficeUi(
  rows: { id: number; kind: RequirementKind; label: string; instructions: string | null; required: boolean }[]
): {
  id: number;
  label: string;
  type: 'checkbox' | 'document' | 'office';
  instructions?: string;
  required: boolean;
}[] {
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    type:
      r.kind === 'document' ? 'document' : r.kind === 'office' ? 'office' : ('checkbox' as const),
    instructions: r.instructions ?? undefined,
    required: r.required,
  }));
}
