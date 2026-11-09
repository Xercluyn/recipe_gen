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

  const showPanel = open || q.trim() !== '';

  return (
    <div className="picker">
      <label className="search">
        <span className="sr-only">{t('generate.search')}</span>
        <Icon name="search" size={18} />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            // Enter inside the search box must not submit the surrounding form.
            if (e.key === 'Enter') e.preventDefault();
          }}
          placeholder={t('generate.search')}
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>

      <div className="chips selected-chips">
        {value.length === 0 && <span className="muted small">{t('generate.fridgeNone')}</span>}
        {value.map((id) => (
          <button key={id} type="button" className="chip on" aria-pressed="true" onClick={() => toggle(id)}>
            <Icon name="check" size={16} stroke={3} />
            {getIngredientName(id, lang)}
          </button>
        ))}
      </div>

      <div className="picker-bar">
        <button
          type="button"
          className="btn ghost small"
          aria-expanded={showPanel}
          onClick={() => {
            if (showPanel) {
              setOpen(false);
              setQ('');
            } else setOpen(true);
          }}
        >
          {showPanel ? (
            t('generate.close')
          ) : (
            <>
              <Icon name="plus" size={16} stroke={2.5} />
              {t('generate.choose')}
            </>
          )}
        </button>
        {value.length > 0 && (
          <button type="button" className="btn link small" onClick={() => onChange([])}>
            {t('generate.clear')}
          </button>
        )}
      </div>

      {showPanel && (
        <div className="picker-panel">
          {groups.length === 0 && <p className="muted small">{t('generate.noMatch')}</p>}
          {groups.map((g) => (
            <div key={g.cat} className="picker-group">
              <h4>{t(`categories.${g.cat}`)}</h4>
              <div className="chips">
                {g.items.map((i) => {
                  const on = selected.has(i.id);
                  return (
                    <button
                      key={i.id}
                      type="button"
                      className={on ? 'chip on' : 'chip'}
                      aria-pressed={on}
                      onClick={() => toggle(i.id)}
                    >
                      {on && <Icon name="check" size={16} stroke={3} />}
                      {lang === 'ja' ? i.ja : i.en}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
