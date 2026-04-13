/**
 * Single source for year level and program lists used in student profile forms and filters.
 * (No 5th year — programs are four-year tracks unless otherwise noted by the school.)
 */

export const YEAR_LEVEL_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year'] as const;

/** Full program names as stored in `profiles.course` */
export const PROGRAM_COURSES = [
  'Bachelor of Science in Information Technology (BSIT)',
  'Bachelor of Science in Business Administration (BSBA)',
  'Bachelor of Secondary Education (BSEd)',
  'Bachelor of Elementary Education (BEEd)',
  'Bachelor of Science in Information Systems (BSIS)',
] as const;

/** Build select options: official list plus current DB value if legacy/custom */
export function programCourseSelectOptions(stored: string | null | undefined): string[] {
  const v = (stored ?? '').trim();
  const list: string[] = [...PROGRAM_COURSES];
  if (v && !list.includes(v)) list.unshift(v);
  return list;
}

export function yearLevelSelectOptions(stored: string | null | undefined): string[] {
  const v = (stored ?? '').trim();
  const list: string[] = [...YEAR_LEVEL_OPTIONS];
  if (v && !list.includes(v)) list.unshift(v);
  return list;
}
