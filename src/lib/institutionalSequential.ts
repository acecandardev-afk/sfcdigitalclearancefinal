/** Terminal line statuses: earlier rows must be in this set before the next can act. */
const CLEARED_PRIOR = new Set(['approved', 'waived']);

export function sortInstitutionalItems<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function isPreviousRowsCleared(
  allItems: { id: string; sortOrder: number; status: string }[],
  itemId: string
): { ok: true } | { ok: false; atSortOrder: number; blocking: string } {
  const sorted = sortInstitutionalItems(allItems);
  const idx = sorted.findIndex((i) => i.id === itemId);
  if (idx < 0) return { ok: false, atSortOrder: 0, blocking: 'Unknown row' };
  for (let j = 0; j < idx; j++) {
    if (!CLEARED_PRIOR.has(sorted[j].status)) {
      return {
        ok: false,
        atSortOrder: sorted[j].sortOrder,
        blocking: 'Previous signatory',
      };
    }
  }
  return { ok: true };
}

export function itemSequentialUnlocked(
  allItems: { id: string; sortOrder: number; status: string }[],
  itemId: string
): boolean {
  return isPreviousRowsCleared(allItems, itemId).ok;
}

/** Every signatory line must be cleared (approved or waived) before the record is marked complete. */
export function allItemsClearedForRecordComplete(items: { status: string }[]): boolean {
  return items.length > 0 && items.every((i) => i.status === 'approved' || i.status === 'waived');
}

/** Next row that must be acted on (queue + item PATCH share this). */
export function activeItemId(
  items: { id: string; sortOrder: number; status: string }[]
): string | null {
  const sorted = sortInstitutionalItems(items);
  const forSeq = sorted.map((s) => ({ id: s.id, sortOrder: s.sortOrder, status: s.status }));
  for (const it of sorted) {
    if (it.status === 'approved' || it.status === 'waived') continue;
    const prevOk = isPreviousRowsCleared(forSeq, it.id);
    if (prevOk.ok) return it.id;
  }
  return null;
}
