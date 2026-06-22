import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseStudentsFromImportBuffer } from './excelStudentImport';

function csvBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function xlsxBuffer(rows: unknown[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Students');
  const out = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return out;
}

describe('parseStudentsFromImportBuffer', () => {
  it('parses CSV with reordered columns', () => {
    const csv = [
      'Course,Year,Student ID,Name',
      'BSIT,1st Year,2024-001,Juan Dela Cruz',
      'BSCS,2nd Year,2024-002,Maria Santos',
    ].join('\n');

    const result = parseStudentsFromImportBuffer(csvBuffer(csv), 'students.csv');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      full_name: 'Juan Dela Cruz',
      student_id: '2024-001',
      year_level: '1st Year',
      course: 'BSIT',
      email: '2024001@student.import',
    });
  });

  it('accepts extra columns and skips incomplete rows', () => {
    const csv = [
      'Name,ID,Year,Course,Notes,Email',
      'Ana Reyes,2024-010,3,BSCS,ok,ana@school.edu',
      'Missing Fields,2024-011,,BSCS,skip',
      ',,,,blank',
    ].join('\n');

    const result = parseStudentsFromImportBuffer(csvBuffer(csv), 'file.csv');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.rows).toHaveLength(1);
    expect(result.skippedRows).toBe(1);
    expect(result.rows[0]?.email).toBe('ana@school.edu');
  });

  it('finds header row when not on first line', () => {
    const csv = [
      'Student import list',
      '',
      'Full name,Student ID,Year level,Course',
      'Pedro Cruz,2024-020,4,BSIT',
    ].join('\n');

    const result = parseStudentsFromImportBuffer(csvBuffer(csv), 'file.csv');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]?.full_name).toBe('Pedro Cruz');
  });

  it('parses Excel files with flexible headers', () => {
    const buffer = xlsxBuffer([
      ['Program', 'ID Number', 'Name', 'Year'],
      ['BSIT', '2024-030', 'Excel Student', '1'],
    ]);

    const result = parseStudentsFromImportBuffer(buffer, 'students.xlsx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]).toMatchObject({
      course: 'BSIT',
      student_id: '2024-030',
      full_name: 'Excel Student',
      year_level: '1',
    });
  });

  it('infers columns from data when headers are abbreviated', () => {
    const csv = [
      'Prog,ID,Nm,Yr',
      'BSIT,2024-040,Juan Cruz,1',
    ].join('\n');

    const result = parseStudentsFromImportBuffer(csvBuffer(csv), 'students.csv');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]?.full_name).toBe('Juan Cruz');
  });

  it('parses file without a header row using data patterns', () => {
    const csv = ['BSIT,2024-050,Maria Santos,2', 'BSCS,2024-051,Pedro Reyes,3'].join('\n');

    const result = parseStudentsFromImportBuffer(csvBuffer(csv), 'students.csv');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
  });
  it('rejects unsupported file types', () => {
    const result = parseStudentsFromImportBuffer(csvBuffer('a,b'), 'notes.txt');
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        message: expect.stringMatching(/csv or excel/i),
      })
    );
  });
});
