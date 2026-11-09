import type { TFunction } from 'i18next';
import type { RecipeIngredient } from '../types';

export function formatAmount(ri: Pick<RecipeIngredient, 'amount' | 'unit'>, t: TFunction): string {
  const n = Math.round(ri.amount * 10) / 10;
  const num = Number.isInteger(n) ? String(n) : n.toFixed(1);
  const unit = t(`units.${ri.unit}`);
  return ri.unit === 'piece' ? `${num}${t('units.piece') === 'pc' ? ' ' : ''}${unit}` : `${num}${unit}`;
}

export function yen(n: number): string {
  return Math.round(n).toLocaleString('ja-JP');
}

export function formatBytes(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return '0 MB';
  const gb = b / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`;
}
