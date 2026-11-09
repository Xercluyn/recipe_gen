import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { formatAmount } from './format';

const units: Record<string, Record<string, string>> = {
  ja: { 'units.g': 'g', 'units.ml': 'ml', 'units.piece': '個', 'units.pinch': '少々' },
  en: { 'units.g': 'g', 'units.ml': 'ml', 'units.piece': 'pc', 'units.pinch': 'a pinch' },
};
const t = (lang: 'ja' | 'en') => ((k: string) => units[lang][k] ?? k) as unknown as TFunction;

describe('formatAmount', () => {
  it('shows liquid seasonings as spoons', () => {
    expect(formatAmount({ id: 'soy_sauce', amount: 15, unit: 'ml' }, t('ja'), 'ja')).toBe('大さじ1');
    expect(formatAmount({ id: 'soy_sauce', amount: 30, unit: 'ml' }, t('ja'), 'ja')).toBe('大さじ2');
    expect(formatAmount({ id: 'soy_sauce', amount: 5, unit: 'ml' }, t('ja'), 'ja')).toBe('小さじ1');
    expect(formatAmount({ id: 'soy_sauce', amount: 7.5, unit: 'ml' }, t('ja'), 'ja')).toBe('大さじ1/2');
    expect(formatAmount({ id: 'soy_sauce', amount: 20, unit: 'ml' }, t('ja'), 'ja')).toBe('大さじ1と小さじ1');
    expect(formatAmount({ id: 'mirin', amount: 15, unit: 'ml' }, t('en'), 'en')).toBe('1 tbsp');
    expect(formatAmount({ id: 'mirin', amount: 2.5, unit: 'ml' }, t('en'), 'en')).toBe('1/2 tsp');
  });

  it('keeps large liquid amounts and non-seasonings in ml/g', () => {
    expect(formatAmount({ id: 'mentsuyu', amount: 100, unit: 'ml' }, t('ja'), 'ja')).toBe('100ml');
    expect(formatAmount({ id: 'chicken_breast', amount: 250, unit: 'g' }, t('ja'), 'ja')).toBe('250g');
  });

  it('formats pieces with fractions and pinch as 少々', () => {
    expect(formatAmount({ id: 'egg', amount: 2, unit: 'piece' }, t('ja'), 'ja')).toBe('2個');
    expect(formatAmount({ id: 'onion', amount: 0.5, unit: 'piece' }, t('ja'), 'ja')).toBe('1/2個');
    expect(formatAmount({ id: 'onion', amount: 1.5, unit: 'piece' }, t('en'), 'en')).toBe('1 1/2 pc');
    expect(formatAmount({ id: 'salt', amount: 1, unit: 'pinch' }, t('ja'), 'ja')).toBe('少々');
    expect(formatAmount({ id: 'salt', amount: 1, unit: 'pinch' }, t('en'), 'en')).toBe('a pinch');
  });
});
