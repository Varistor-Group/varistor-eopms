/**
 * Shared fetch wrapper for the PHP/MySQL backend.
 * Attaches X-Employee-Id from the logged-in user, stored the same way
 * EopmsContext persists it (localStorage key 'eopms_current_user').
 *
 * NOTE: Task 2 (Authentication) is done — login.php now issues a real
 * Bearer token, and helpers.php's currentEmployeeId() checks
 * `Authorization: Bearer <token>` first, falling back to X-Employee-Id
 * only for callers not yet updated. This file still only sends the
 * legacy X-Employee-Id header, so every request here is silently using
 * the weaker fallback path instead of the real session token. Needs a
 * follow-up pass to switch this to sending the stored Bearer token.
 */
import { API_URL } from '../config/api';

function getCurrentEmployeeId(): string | null {
  try {
    const saved = localStorage.getItem('eopms_current_user');
    if (!saved) return null;
    const user = JSON.parse(saved);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

interface ApiFetchOptions extends RequestInit {
  isMultipart?: boolean;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const empId = getCurrentEmployeeId();
  const { isMultipart, ...rest } = options;
  const headers = new Headers(options.headers);

  if (!isMultipart) {
    headers.set('Content-Type', 'application/json');
  }
  if (empId) headers.set('X-Employee-Id', empId);

  return fetch(`${API_URL}${path}`, { ...rest, headers });
}