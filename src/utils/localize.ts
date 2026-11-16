import type { Lang, Localized } from '@engine';

/**
 * Pick localized text for `lang`, falling back to `fallback` (or the other available language),
 * and finally `defaultText` when missing.
 */
export function pickLocalized(
  loc: Localized | null | undefined,
  lang: Lang,
  fallback: Lang = 'en',
  defaultText = '',
): string {
  if (!loc) return defaultText;
  const direct = loc[lang]?.trim();
  if (direct) return direct;
  const fb = loc[fallback]?.trim();
  if (fb) return fb;
  const other = (lang === 'th' ? loc.en : loc.th)?.trim();
  return other || defaultText;
}

/** Validate an uploaded image file against allowed formats and size (max 5 MiB). */
export function validateImageFile(file: File): { ok: true } | { ok: false; reason: 'TYPE' | 'SIZE' } {
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  if (!allowed.has(file.type)) return { ok: false, reason: 'TYPE' };
  if (file.size > 5 * 1024 * 1024) return { ok: false, reason: 'SIZE' };
  return { ok: true };
}

/** Format milliseconds or seconds cleanly as MM:SS. */
export function formatDuration(secondsTotal: number): string {
  const s = Math.max(0, Math.floor(secondsTotal));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Escape CSV field and emit UTF-8 BOM CSV so Thai characters open cleanly in Excel. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return '\uFEFF' + [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
}
