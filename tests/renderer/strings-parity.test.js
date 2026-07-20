import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function loadStrings() {
  const code = fs.readFileSync(path.join(process.cwd(), 'src/renderer/i18n/strings.js'), 'utf8');
  const win = {};
  new Function('window', code)(win);
  return win.NYX_STRINGS;
}

describe('string dictionaries', () => {
  it('en and uk have identical key sets', () => {
    const s = loadStrings();
    expect(Object.keys(s.uk).sort()).toEqual(Object.keys(s.en).sort());
  });
  it('no empty values', () => {
    const s = loadStrings();
    for (const loc of ['en', 'uk']) for (const k of Object.keys(s[loc])) expect(String(s[loc][k]).length).toBeGreaterThan(0);
  });
});
