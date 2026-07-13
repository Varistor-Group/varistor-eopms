/**
 * Central API URL config.
 * In development: http://localhost:3001 (Vite proxy not used — direct call)
 * In production:  set VITE_API_URL to your Render backend URL
 *   e.g. https://varistor-eopms-api.onrender.com
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
