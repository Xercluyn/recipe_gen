import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IngredientCategory } from '../types';
import { INGREDIENTS, getIngredientName } from '../data/ingredients';
import { currentLang } from '../i18n';
import { Icon } from './ui';

const ORDER: IngredientCategory[] = [
  'vegetable',
  'mushroom',
  'meat',
  'seafood',
  'egg_dairy',
  'tofu_soy',
  'grain_noodle',
  'other',
  'seasoning',
];

/** Kana-insensitive-ish normalisation: katakana -> hiragana, lowercase, NFKC. */
function norm(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function IngredientPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const lang = currentLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = useMemo(() => new Set(value), [value]);

  const toggle = (id: string) =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  const groups = useMemo(() => {
    const nq = norm(q.trim());
    const list = INGREDIENTS.filter((i) => !i.pantry).filter(
      (i) => !nq || norm(i.ja).includes(nq) || norm(i.en).includes(nq) || i.id.includes(nq),
    );
    return ORDER.map((cat) => ({ cat, items: list.filter((i) => i.category === cat) })).filter(
      (g) => g.items.length > 0,
    );
  }, [q]);

  return (
    <div className="picker">
      <div className="chips selected-chips">
        {value.length === 0 && <span className="muted small">{t('generate.fridgeNone')}</span>}
        {value.map((id) => (
          <button key={id} type="button" className="chip on" onClick={() => toggle(id)}>
            {getIngredientName(id, lang)}
            <Icon name="x" size={14} />
          </button>
        ))}
      </div>

      <div className="picker-bar">
        <button type="button" className="btn ghost small" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? t('generate.close') : `+ ${t('generate.choose')}`}
        </button>
        {value.length > 0 && (
          <button type="button" className="btn link small" onClick={() => onChange([])}>
            {t('generate.clear')}
          </button>
        )}
      </div>

      {open && (
        <div className="picker-panel">
          <label className="search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('generate.search')}
              aria-label={t('generate.search')}
              autoComplete="off"
            />
          </label>
          {groups.length === 0 && <p className="muted small">{t('generate.noMatch')}</p>}
          {groups.map((g) => (
            <div key={g.cat} className="picker-group">
              <h4>{t(`categories.${g.cat}`)}</h4>
              <div className="chips">
                {g.items.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className={selected.has(i.id) ? 'chip on' : 'chip'}
                    aria-pressed={selected.has(i.id)}
                    onClick={() => toggle(i.id)}
                  >
                    {lang === 'ja' ? i.ja : i.en}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
