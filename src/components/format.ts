import type { TFunction } from 'i18next';
import type { Lang, RecipeIngredient } from '../types';
import { INGREDIENT_MAP } from '../data/ingredients';
import { currentLang } from '../i18n';

const FRACTIONS: Record<string, string> = { '0.25': '1/4', '0.5': '1/2', '0.75': '3/4' };

/** 1.5 -> "1と1/2" (ja) / "1 1/2" (en); 0.5 -> "1/2". */
function frac(n: number, lang: Lang): string {
  const r = Math.round(n * 4) / 4;
  const whole = Math.floor(r);
  const f = FRACTIONS[String(r - whole)];
  if (!f) return String(whole);
  if (whole === 0) return f;
  return lang === 'ja' ? `${whole}と${f}` : `${whole} ${f}`;
}

/** Liquid seasoning in ml -> 大さじ/小さじ (tbsp/tsp). Returns null when not sensible. */
function spoons(ml: number, lang: Lang): string | null {
  if (ml <= 0 || ml > 60) return null;
  let tbsp = Math.floor(ml / 15 + 1e-9);
  let tsp = Math.round(((ml - tbsp * 15) / 5) * 4) / 4;
  if (tsp >= 3) {
    tbsp += 1;
    tsp = 0;
  }
  if (tbsp === 0 && tsp === 0) tsp = 0.25;
  // Prefer "大さじ1/2" over "小さじ1と1/2" for exactly half a tablespoon.
  if (tbsp === 0 && tsp === 1.5) return lang === 'ja' ? '大さじ1/2' : '1/2 tbsp';
  const parts: string[] = [];
  if (tbsp) parts.push(lang === 'ja' ? `大さじ${frac(tbsp, lang)}` : `${frac(tbsp, lang)} tbsp`);
  if (tsp) parts.push(lang === 'ja' ? `小さじ${frac(tsp, lang)}` : `${frac(tsp, lang)} tsp`);
  return parts.join(lang === 'ja' ? 'と' : ' + ');
}

export function formatAmount(
  ri: Pick<RecipeIngredient, 'amount' | 'unit'> & { id?: string },
  t: TFunction,
  lang: Lang = currentLang(),
): string {
  if (ri.unit === 'pinch') return t('units.pinch');
  const ing = ri.id ? INGREDIENT_MAP[ri.id] : undefined;
  if (ri.unit === 'ml' && ing?.category === 'seasoning') {
    const s = spoons(ri.amount, lang);
    if (s) return s;
  }
  if (ri.unit === 'piece') {
    const unit = t('units.piece');
    const num = frac(ri.amount, lang);
    return lang === 'ja' ? `${num}${unit}` : `${num} ${unit}`;
  }
  const n = ri.amount >= 10 ? Math.round(ri.amount) : Math.round(ri.amount * 10) / 10;
  return `${n}${t(`units.${ri.unit}`)}`;
}

export function yen(n: number): string {
  return Math.round(n).toLocaleString('ja-JP');
}

export function formatBytes(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return '0 MB';
  const gb = b / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`;
}
