/**
 * Small idempotency helpers and types used by command handlers.
 */

export interface IIdempotencyRecord {
  id: string;
  createdAt: string; // ISO timestamp
  commandId?: string;
  resultLocation?: string;
}

export function normalizeCommandId(id?: string | null): string | null {
  if (!id) return null;
  const s = String(id).trim();
  return s.length === 0 ? null : s;
}
