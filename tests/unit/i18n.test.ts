import { describe, expect, it } from 'vitest';
import { I18N_NAMESPACES, STATIC_RESOURCES } from '@/i18n/config';
import { pickLocalized, toCsv, validateImageFile } from '@/utils/localize';

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') keys.push(path);
    else if (v && typeof v === 'object') keys.push(...collectKeys(v as Record<string, unknown>, path));
  }
  return keys.sort();
}

describe('i18n parity & utilities', () => {
  for (const ns of I18N_NAMESPACES) {
    it(`namespace "${ns}" has identical keys in Thai and English`, () => {
      const enKeys = collectKeys(STATIC_RESOURCES.en[ns]);
      const thKeys = collectKeys(STATIC_RESOURCES.th[ns]);
      expect(thKeys).toEqual(enKeys);
    });
  }

  it('pickLocalized falls back cleanly when requested language is empty', () => {
    expect(pickLocalized({ th: '', en: 'Robot' }, 'th', 'en')).toBe('Robot');
    expect(pickLocalized({ th: 'หุ่นยนต์', en: '' }, 'en', 'th')).toBe('หุ่นยนต์');
    expect(pickLocalized({}, 'th', 'en', 'Fallback')).toBe('Fallback');
  });

  it('validateImageFile enforces allowed MIME types and 5 MiB limit', () => {
    const ok = new File([new Uint8Array(100)], 'robot.png', { type: 'image/png' });
    expect(validateImageFile(ok)).toEqual({ ok: true });

    const badType = new File(['<svg/>'], 'evil.svg', { type: 'image/svg+xml' });
    expect(validateImageFile(badType)).toEqual({ ok: false, reason: 'TYPE' });

    const tooBig = new File([new Uint8Array(5 * 1024 * 1024 + 10)], 'huge.png', { type: 'image/png' });
    expect(validateImageFile(tooBig)).toEqual({ ok: false, reason: 'SIZE' });
  });

  it('toCsv emits UTF-8 BOM and properly quotes cells', () => {
    const out = toCsv(['Name', 'School'], [['ต้นกล้า', 'School, "A"']]);
    expect(out.startsWith('\uFEFF')).toBe(true);
    expect(out).toContain('"School, ""A"""');
  });
});
