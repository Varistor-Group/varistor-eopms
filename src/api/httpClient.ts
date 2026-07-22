/**
 * Shared fetch wrapper for the PHP/MySQL backend.
 * Attaches X-Employee-Id from the logged-in user, stored the same way
 * EopmsContext persists it (localStorage key 'eopms_current_user').
 *
 * PLACEHOLDER: X-Employee-Id is a stopgap until Task 2 (Authentication)
 * builds real session/token handling — see helpers.php on the backend.
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

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const empId = getCurrentEmployeeId();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (empId) headers.set('X-Employee-Id', empId);
  return fetch(`${API_URL}${path}`, { ...options, headers });
}