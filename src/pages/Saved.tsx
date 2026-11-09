import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db, toggleFavorite } from '../db/db';
import { INGREDIENT_MAP } from '../data/ingredients';
import { costPerServing } from '../lib/cost';
import { yen } from '../components/format';
import { Icon, Segmented, Spinner } from '../components/ui';

export default function Saved() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'fav'>('all');
  const recipes = useLiveQuery(() => db.recipes.orderBy('createdAt').reverse().toArray(), []);

  const shown = useMemo(() => {
    if (!recipes) return [];
    const nq = q.trim().toLowerCase();
    return recipes.filter((r) => {
      if (filter === 'fav' && !r.favorite) return false;
      if (!nq) return true;
      if (r.title.toLowerCase().includes(nq) || r.prompt.toLowerCase().includes(nq)) return true;
      return r.ingredients.some((ri) => {
        const ing = INGREDIENT_MAP[ri.id];
        return ing && (ing.ja.includes(nq) || ing.en.toLowerCase().includes(nq));
      });
    });
  }, [recipes, q, filter]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('saved.title')}</h1>
      </header>

      {recipes && recipes.length > 0 && (
        <div className="toolbar">
          <label className="search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('saved.search')}
              aria-label={t('saved.search')}
            />
          </label>
          <Segmented
            label={t('saved.favoritesOnly')}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('saved.all') },
              { value: 'fav', label: <>★ {t('saved.favoritesOnly')}</> },
            ]}
          />
        </div>
      )}

      {!recipes ? (
        <div className="center pad">
          <Spinner />
        </div>
      ) : recipes.length === 0 ? (
        <div className="empty">
          <Icon name="bookmark" size={40} />
          <p>{t('saved.empty')}</p>
          <Link to="/" className="btn primary">
            {t('saved.emptyCta')}
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <p className="muted center pad">{t('saved.noMatch')}</p>
      ) : (
        <ul className="saved-list">
          {shown.map((r) => (
            <li key={r.id} className="saved-item">
              <Link to={`/recipe/${r.id}`} className="saved-link">
                <span className="saved-title">{r.title}</span>
                <span className="saved-meta">
                  <span>
                    <Icon name="clock" size={14} /> {t('common.minutes', { n: r.totalMinutes })}
                  </span>
                  <span className="accent-text">{t('common.perServing', { n: yen(costPerServing(r)) })}</span>
                  <span>{new Date(r.createdAt).toLocaleDateString(r.lang === 'ja' ? 'ja-JP' : 'en-US')}</span>
                </span>
              </Link>
              <button
                type="button"
                className={r.favorite ? 'fav-btn on' : 'fav-btn'}
                aria-pressed={r.favorite}
                aria-label={r.favorite ? t('detail.unfavorite') : t('detail.favorite')}
                onClick={() => r.id != null && void toggleFavorite(r.id)}
              >
                <Icon name="star" filled={r.favorite} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
