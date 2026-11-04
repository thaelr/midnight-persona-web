import assert from 'node:assert/strict';
import test from 'node:test';
import { localeLanguage } from '../src/lib/auth';

test('locale selection agrees with the audited Gateway language fallback', () => {
  const cases: Array<[string | undefined, 'ru' | 'en' | null]> = [
    [undefined, null], ['', null], ['   ', null],
    ['ru', 'ru'], ['RU_ru', 'ru'], [' en-US ', 'en'], ['en-KZ', 'en'],
    ['uk', 'ru'], ['be', 'ru'], ['kk-Cyrl-KZ', 'ru'], ['zh-Hans-KZ', 'ru'],
    ['fr-FR', 'en'], ['vi-VN', 'en'], ['zh-Hant-TW', 'en'],
  ];
  for (const [locale, expected] of cases) assert.equal(localeLanguage(locale), expected, String(locale));
});
