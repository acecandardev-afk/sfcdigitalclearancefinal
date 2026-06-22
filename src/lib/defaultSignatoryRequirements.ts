import type { PrismaClient, RequirementKind } from '@prisma/client';

export const DEFAULT_SIGNATORY_REQUIREMENT_ROWS: {
  kind: RequirementKind;
  label: string;
  instructions: string;
  sortOrder: number;
  required: boolean;
}[] = [
  {
    kind: 'document',
    label: 'Upload supporting documents',
    instructions: 'Attach any documents this office requires.',
    sortOrder: 1,
    required: true,
  },
  {
    kind: 'physical',
    label: 'Physical clearance attestation',
    instructions: 'Confirm you have no physical items or liabilities at this office.',
    sortOrder: 2,
    required: true,
  },
  {
    kind: 'office',
    label: 'In-person walk-in verification',
    instructions: 'Visit this office for in-person verification after you submit.',
    sortOrder: 3,
    required: true,
  },
];

export async function seedDefaultSignatoryRequirements(prisma: PrismaClient, signatoryId: string) {
  for (const row of DEFAULT_SIGNATORY_REQUIREMENT_ROWS) {
    await prisma.signatoryRequirement.create({
      data: {
        signatoryId,
        kind: row.kind,
        label: row.label,
        instructions: row.instructions,
        sortOrder: row.sortOrder,
        required: row.required,
      },
    });
  }
}
