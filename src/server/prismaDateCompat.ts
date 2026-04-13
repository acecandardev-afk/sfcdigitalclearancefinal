/**
 * Some generated Prisma clients lag migrations and omit `createdAt` on certain models in TypeScript.
 * Read timestamps safely at runtime without relying on those properties in the static type.
 *
 * After changing `prisma/schema.prisma`, run migrations and regenerate the client so types match
 * the database (e.g. `npx prisma migrate dev` then `npx prisma generate`, or `prisma db pull` if
 * introspecting). Until then, these helpers keep API routes type-safe and correct at runtime.
 */

export function optionalDateProp(row: object, key: 'createdAt' | 'updatedAt'): Date | null {
  const v = (row as Record<string, unknown>)[key];
  return v instanceof Date ? v : null;
}

/** ClearanceSignature: prefer createdAt when present, else signedAt. */
export function clearanceSignatureActivityDate(row: { signedAt: Date | null }): Date | null {
  const created = optionalDateProp(row as object, 'createdAt');
  if (created) return created;
  return row.signedAt ?? null;
}

/** Any model that may have createdAt (e.g. Signatory). */
export function modelCreatedAtOrNull(row: object): Date | null {
  return optionalDateProp(row, 'createdAt');
}
