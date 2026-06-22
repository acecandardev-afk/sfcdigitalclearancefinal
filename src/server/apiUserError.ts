import { NextResponse } from 'next/server';
import {
  USER_MSG_FORBIDDEN,
  USER_MSG_GENERIC,
  USER_MSG_NOT_FOUND,
  USER_MSG_SERVER,
  USER_MSG_UNAUTHORIZED,
  USER_MSG_VALIDATION,
} from '@/lib/userMessages';

/** JSON error body for API routes — omit `detail`, `issues`, and stack traces. */
export function apiErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Safe 400 when request body fails schema validation. */
export function apiValidationErrorResponse() {
  return apiErrorResponse(apiMsg.validation, 400);
}

export const apiMsg = {
  unauthorized: USER_MSG_UNAUTHORIZED,
  forbidden: USER_MSG_FORBIDDEN,
  notFound: USER_MSG_NOT_FOUND,
  validation: USER_MSG_VALIDATION,
  server: USER_MSG_SERVER,
  generic: USER_MSG_GENERIC,
} as const;
