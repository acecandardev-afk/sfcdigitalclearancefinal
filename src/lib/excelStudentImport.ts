import * as XLSX from 'xlsx';

export type ParsedStudentRow = {
  rowNumber: number;
  email: string;
  full_name: string;
  student_id: string;
  year_level: string;
  course: string;
};

export type ParseStudentsFromExcelResult =
  | { ok: true; rows: ParsedStudentRow[]; skippedRows: number }
  | { ok: false; message: string };

type StudentField = 'email' | 'full_name' | 'student_id' | 'year_level' | 'course';

const REQUIRED_FIELDS: StudentField[] = ['full_name', 'student_id', 'year_level', 'course'];

/** Map normalized header labels to field keys */
const HEADER_ALIASES: Record<string, StudentField> = {
  email: 'email',
  'e-mail': 'email',
  'email address': 'email',
  fullname: 'full_name',
  'full name': 'full_name',
  'student name': 'full_name',
  name: 'full_name',
  'last name': 'full_name',
  'complete name': 'full_name',
  student: 'full_name',
  pangalan: 'full_name',
  id: 'student_id',
  no: 'student_id',
  number: 'student_id',
  '#': 'student_id',
  'student id': 'student_id',
  'student id no': 'student_id',
  'student id number': 'student_id',
  'school id': 'student_id',
  'student no': 'student_id',
  'student no.': 'student_id',
  'student number': 'student_id',
  'id number': 'student_id',
  'id no': 'student_id',
  'id #': 'student_id',
  lrn: 'student_id',
  'year level': 'year_level',
  year: 'year_level',
  yr: 'year_level',
  yrs: 'year_level',
  level: 'year_level',
  'grade level': 'year_level',
  grade: 'year_level',
  section: 'year_level',
  'year section': 'year_level',
  'yr level': 'year_level',
  course: 'course',
  program: 'course',
  strand: 'course',
  department: 'course',
  major: 'course',
  'course/program': 'course',
  'program/course': 'course',
  'course code': 'course',
  'program code': 'course',
};

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_./]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function scoreHeaderForField(normalized: string, field: StudentField): number {
  if (!normalized) return 0;

  if (HEADER_ALIASES[normalized] === field) return 100;

  switch (field) {
    case 'email':
      if (normalized.includes('email') || normalized.includes('e mail')) return 60;
      break;
    case 'full_name':
      if (normalized.includes('pangalan')) return 80;
      if (normalized === 'student' || normalized === 'students') return 70;
      if (normalized.includes('name') && !normalized.includes('file') && !normalized.includes('user name')) {
        return normalized.includes('full') || normalized.includes('complete') ? 90 : 70;
      }
      break;
    case 'student_id':
      if (normalized.includes('student id') || normalized.includes('student no') || normalized.includes('student number')) {
        return 90;
      }
      if (normalized.includes('id number') || normalized.includes('id no') || normalized.includes('school id')) {
        return 85;
      }
      if (normalized === 'id' || normalized === 'no' || normalized === 'number' || normalized === 'lrn') return 75;
      if (normalized.endsWith(' id') || normalized.startsWith('id ')) return 65;
      if (normalized.includes(' id ') && !normalized.includes('valid')) return 55;
      break;
    case 'year_level':
      if (normalized.includes('year level') || normalized.includes('yr level') || normalized.includes('year section')) {
        return 90;
      }
      if (normalized.includes('year') || normalized.includes('grade') || normalized.includes('section')) return 75;
      if (normalized === 'yr' || normalized === 'yrs' || normalized === 'level') return 60;
      break;
    case 'course':
      if (normalized.includes('course') || normalized.includes('program') || normalized.includes('strand')) return 85;
      if (normalized.includes('major') || normalized.includes('department')) return 65;
      break;
  }

  return 0;
}

function findBestColumnMapping(headerRow: unknown[]): Partial<Record<StudentField, number>> {
  const scored: Array<{ field: StudentField; col: number; score: number }> = [];

  headerRow.forEach((cell, colIndex) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return;

    for (const field of [...REQUIRED_FIELDS, 'email'] as StudentField[]) {
      const score = scoreHeaderForField(normalized, field);
      if (score > 0) scored.push({ field, col: colIndex, score });
    }
  });

  scored.sort((a, b) => b.score - a.score);

  const mapping: Partial<Record<StudentField, number>> = {};
  const usedCols = new Set<number>();

  for (const { field, col, score } of scored) {
    if (mapping[field] !== undefined || usedCols.has(col)) continue;
    if (score < 50) continue;
    mapping[field] = col;
    usedCols.add(col);
  }

  return mapping;
}

function scoreCellAsName(value: string): number {
  if (!value || value.length < 2) return 0;
  if (isValidEmail(value)) return 0;
  if (/^\d+$/.test(value)) return 0;
  if (/^[A-Za-z][A-Za-z\s.'-]{2,}$/.test(value) && /\s/.test(value)) return 4;
  if (/^[A-Za-z][A-Za-z\s.'-]{2,}$/.test(value)) return 2;
  return 0;
}

function scoreCellAsId(value: string): number {
  if (!value) return 0;
  if (/^\d{4,}(-\d+)?$/.test(value)) return 4;
  if (/^\d+$/.test(value) && value.length >= 4 && value.length <= 15) return 3;
  if (/^[A-Z0-9-]{4,}$/i.test(value) && /\d/.test(value)) return 2;
  return 0;
}

function scoreCellAsYear(value: string): number {
  if (!value) return 0;
  if (/^(1st|2nd|3rd|4th|4th)\b/i.test(value)) return 4;
  if (/^grade\s*[1-9]/i.test(value)) return 4;
  if (/^[1-5]$/.test(value)) return 3;
  if (/year|yr|grade|level|section/i.test(value) && value.length <= 20) return 2;
  return 0;
}

function scoreCellAsCourse(value: string): number {
  if (!value) return 0;
  if (/^(BS|BA|BSC|BSIT|BSCS|BSED|BEED|AB|BSA|BSBA)[A-Z]*$/i.test(value)) return 4;
  if (/bachelor|accountancy|education|technology|informatics|nursing|criminology/i.test(value)) return 3;
  if (/^[A-Z]{2,8}$/.test(value)) return 2;
  return 0;
}

function inferColumnsFromData(
  matrix: unknown[][],
  startRow: number
): Partial<Record<StudentField, number>> {
  const sampleRows = matrix
    .slice(startRow, startRow + 50)
    .filter((row) => Array.isArray(row) && row.some((cell) => cellToString(cell) !== ''));

  if (!sampleRows.length) return {};

  const colCount = Math.max(...sampleRows.map((row) => row.length), 0);
  const totals: Record<StudentField, number[]> = {
    email: Array(colCount).fill(0),
    full_name: Array(colCount).fill(0),
    student_id: Array(colCount).fill(0),
    year_level: Array(colCount).fill(0),
    course: Array(colCount).fill(0),
  };

  for (const row of sampleRows) {
    for (let col = 0; col < colCount; col++) {
      const value = cellToString(row[col]);
      if (!value) continue;
      totals.full_name[col] += scoreCellAsName(value);
      totals.student_id[col] += scoreCellAsId(value);
      totals.year_level[col] += scoreCellAsYear(value);
      totals.course[col] += scoreCellAsCourse(value);
      if (isValidEmail(value)) totals.email[col] += 4;
    }
  }

  const mapping: Partial<Record<StudentField, number>> = {};
  const usedCols = new Set<number>();

  for (const field of [...REQUIRED_FIELDS, 'email'] as StudentField[]) {
    let bestCol = -1;
    let bestScore = 0;
    for (let col = 0; col < colCount; col++) {
      if (usedCols.has(col)) continue;
      const score = totals[field][col] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }
    if (bestCol >= 0 && bestScore >= 2) {
      mapping[field] = bestCol;
      usedCols.add(bestCol);
    }
  }

  return mapping;
}

function mergeMappings(
  primary: Partial<Record<StudentField, number>>,
  fallback: Partial<Record<StudentField, number>>
): Partial<Record<StudentField, number>> {
  return {
    email: primary.email ?? fallback.email,
    full_name: primary.full_name ?? fallback.full_name,
    student_id: primary.student_id ?? fallback.student_id,
    year_level: primary.year_level ?? fallback.year_level,
    course: primary.course ?? fallback.course,
  };
}

function hasRequiredColumns(indexByField: Partial<Record<StudentField, number>>): boolean {
  return REQUIRED_FIELDS.every((field) => indexByField[field] !== undefined);
}

type ResolvedMapping = {
  headerRowIndex: number;
  dataStartRow: number;
  indexByField: Partial<Record<StudentField, number>>;
};

function isHeaderRow(row: unknown[]): boolean {
  const labels = row.map((cell) => normalizeHeader(cell)).filter(Boolean);
  if (labels.length < 2) return false;

  let headerLike = 0;
  for (const label of labels) {
    for (const field of REQUIRED_FIELDS) {
      if (scoreHeaderForField(label, field) >= 50) {
        headerLike++;
        break;
      }
    }
  }

  return headerLike >= 2;
}

function resolveMapping(matrix: unknown[][]): ResolvedMapping | null {
  const scanLimit = Math.min(matrix.length, 30);

  for (let headerIdx = 0; headerIdx < scanLimit; headerIdx++) {
    const headerRow = matrix[headerIdx];
    if (!Array.isArray(headerRow) || !isHeaderRow(headerRow)) continue;

    const headerMapping = findBestColumnMapping(headerRow);
    const dataMapping = inferColumnsFromData(matrix, headerIdx + 1);
    const combined = mergeMappings(headerMapping, dataMapping);

    if (hasRequiredColumns(combined)) {
      return {
        headerRowIndex: headerIdx,
        dataStartRow: headerIdx + 1,
        indexByField: combined,
      };
    }
  }

  const dataOnly = inferColumnsFromData(matrix, 0);
  if (hasRequiredColumns(dataOnly)) {
    return {
      headerRowIndex: -1,
      dataStartRow: 0,
      indexByField: dataOnly,
    };
  }

  return null;
}

function describeDetectedHeaders(matrix: unknown[][]): string {
  for (let i = 0; i < Math.min(matrix.length, 8); i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const labels = row.map((cell) => cellToString(cell)).filter(Boolean);
    if (labels.length >= 2) {
      return labels.slice(0, 8).join(', ');
    }
  }
  return 'none detected';
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }

  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return String(value).trim();
}

function matricesFromWorkbook(buffer: ArrayBuffer): unknown[][][] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return [];
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];
    return matrix.filter((row) => Array.isArray(row) && row.some((cell) => cellToString(cell) !== ''));
  }).filter((matrix) => matrix.length > 0);
}

function matrixFromBuffer(buffer: ArrayBuffer, fileName: string): unknown[][] | unknown[][][] | { error: string } {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.csv')) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer).replace(/^\uFEFF/, '');
    return parseCsv(text);
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    try {
      const matrices = matricesFromWorkbook(buffer);
      if (!matrices.length) {
        return { error: 'The Excel file has no readable rows.' };
      }
      if (matrices.length === 1) return matrices[0]!;
      return matrices;
    } catch {
      return { error: 'Could not read the Excel file. Save it as .xlsx or .csv and try again.' };
    }
  }

  return { error: 'Please choose a CSV or Excel file (.csv, .xlsx, .xls).' };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function deriveEmail(studentId: string, rowIndex: number): string {
  const base =
    studentId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() ||
    `student${rowIndex}`;
  return `${base}@student.import`;
}

function parseMatrix(matrix: unknown[][]): ParseStudentsFromExcelResult {
  if (!matrix.length) {
    return { ok: false, message: 'The file appears empty.' };
  }

  const resolved = resolveMapping(matrix);
  if (!resolved) {
    return {
      ok: false,
      message: `Could not find Name, Student ID, Year, and Course in this file. Headers seen: ${describeDetectedHeaders(matrix)}. You can use any column names — try the download template if needed.`,
    };
  }

  const { dataStartRow, indexByField } = resolved;
  const nameIx = indexByField.full_name!;
  const sidIx = indexByField.student_id!;
  const ylIx = indexByField.year_level!;
  const courseIx = indexByField.course!;
  const emailIx = indexByField.email;

  const rows: ParsedStudentRow[] = [];
  const seenEmails = new Set<string>();
  let skippedRows = 0;

  for (let i = dataStartRow; i < matrix.length; i++) {
    const r = matrix[i] as unknown[];
    if (!r || !r.length) continue;

    const take = (ix: number | undefined) => (ix === undefined ? '' : cellToString(r[ix]));

    const fullNameRaw = take(nameIx);
    const studentIdRaw = take(sidIx);
    const yearLevelRaw = take(ylIx);
    const courseRaw = take(courseIx);
    const emailRaw = emailIx === undefined ? '' : take(emailIx).toLowerCase();

    const isTotallyBlank =
      !fullNameRaw && !studentIdRaw && !yearLevelRaw && !courseRaw && !emailRaw;

    if (isTotallyBlank) continue;

    if (!fullNameRaw || !studentIdRaw || !yearLevelRaw || !courseRaw) {
      skippedRows++;
      continue;
    }

    const rowNumber = i + 1;
    let email = emailRaw;

    if (!email || !isValidEmail(email)) {
      email = deriveEmail(studentIdRaw, rowNumber);
    }

    if (seenEmails.has(email)) {
      email = deriveEmail(`${studentIdRaw}-${rowNumber}`, rowNumber);
    }

    if (seenEmails.has(email)) {
      skippedRows++;
      continue;
    }

    seenEmails.add(email);

    rows.push({
      rowNumber,
      email,
      full_name: fullNameRaw,
      student_id: studentIdRaw,
      year_level: yearLevelRaw,
      course: courseRaw,
    });
  }

  if (!rows.length) {
    return {
      ok: false,
      message:
        'No valid student rows found. Each row needs Name, Student ID, Year, and Course. Extra columns and different header labels are OK.',
    };
  }

  return { ok: true, rows, skippedRows };
}

function pickBestParseResult(results: ParseStudentsFromExcelResult[]): ParseStudentsFromExcelResult {
  const successes = results.filter((r): r is Extract<ParseStudentsFromExcelResult, { ok: true }> => r.ok);
  if (successes.length === 0) {
    return results[0] ?? { ok: false, message: 'The file appears empty.' };
  }
  return successes.reduce((best, current) =>
    current.rows.length > best.rows.length ? current : best
  );
}

/** Supported extensions for bulk student import */
export const STUDENT_IMPORT_ACCEPT =
  '.csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function isStudentImportFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls');
}

/**
 * Parses a CSV or Excel import file into student rows.
 * Required columns (any compatible header, any order): name, student id, year, course.
 * Optional: email (auto-generated from student id when missing).
 * Extra columns are ignored. Invalid rows are skipped instead of failing the whole file.
 */
export function parseStudentsFromImportBuffer(
  buffer: ArrayBuffer,
  fileName: string
): ParseStudentsFromExcelResult {
  if (!isStudentImportFileName(fileName)) {
    return { ok: false, message: 'Please choose a CSV or Excel file (.csv, .xlsx, .xls).' };
  }

  const matrixOrError = matrixFromBuffer(buffer, fileName);
  if ('error' in matrixOrError) {
    return { ok: false, message: matrixOrError.error };
  }

  if (Array.isArray(matrixOrError[0]) && Array.isArray((matrixOrError as unknown[][][])[0]?.[0])) {
    const matrices = matrixOrError as unknown[][][];
    return pickBestParseResult(matrices.map((matrix) => parseMatrix(matrix)));
  }

  return parseMatrix(matrixOrError as unknown[][]);
}

/** @deprecated Use parseStudentsFromImportBuffer */
export function parseStudentsFromCsvBuffer(buffer: ArrayBuffer): ParseStudentsFromExcelResult {
  return parseStudentsFromImportBuffer(buffer, 'import.csv');
}
