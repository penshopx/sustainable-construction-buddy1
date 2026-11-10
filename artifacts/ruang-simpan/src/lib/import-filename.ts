import { ALLOWED_EXT, extOf } from './vault';

/**
 * A suggestion only: never copy a URL, query, fragment, or directory into a
 * document name. Decode the last pathname segment once and fail closed.
 */
export function importFilename(raw: string): string {
  try {
    // URL normalizes literal tabs/newlines, so reject them before parsing.
    if (/[\p{Cc}\p{Cf}]/u.test(raw)) return '';
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    const segment = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
    const name = decodeURIComponent(segment).trim();
    if (!name || name.length > 200 || name.startsWith('.') ||
        /[\\/:?&#=%<>|"*\p{Cc}\p{Cf}]/u.test(name)) return '';
    return ALLOWED_EXT.includes(extOf(name)) ? name : '';
  } catch {
    return '';
  }
}
