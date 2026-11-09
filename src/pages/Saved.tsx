import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db, toggleFavorite } from '../db/db';
import { INGREDIENT_MAP } from '../data/ingredients';
import { costPerServing } from '../lib/cost';
import { yen } from '../components/format';
import { Icon, Spinner } from '../components/ui';
import { StarGlyph } from '../components/RecipeCard';

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

  const favCount = recipes ? recipes.filter((r) => r.favorite).length : 0;
  const wideFirst = shown.length % 2 === 1;

  return (
    <div className="page">
      <header className="page-head saved-head">
        <h1>{t('saved.title')}</h1>
        {recipes && recipes.length > 0 && <span className="bento-badge">{t('saved.count', { n: recipes.length })}</span>}
      </header>

      {recipes && recipes.length > 0 && (
        <div className="saved-toolbar">
          <label className="search saved-search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('saved.search')}
              aria-label={t('saved.search')}
            />
          </label>
          <div className="saved-filters" role="group" aria-label={t('saved.filter')}>
            <button
              type="button"
              className="saved-filter"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              {t('saved.all')}
              <span className="saved-filter-n">{recipes.length}</span>
            </button>
            <button
              type="button"
              className="saved-filter fav"
              aria-pressed={filter === 'fav'}
              onClick={() => setFilter('fav')}
            >
              <StarGlyph size={16} />
              {t('saved.favoritesOnly')}
              <span className="saved-filter-n">{favCount}</span>
            </button>
          </div>
        </div>
      )}

      {!recipes ? (
        <div className="center pad">
          <Spinner />
        </div>
      ) : recipes.length === 0 ? (
        <div className="bento-tile saved-empty">
          <span className="saved-empty-icon" aria-hidden="true">
            <Icon name="bookmark" size={32} />
          </span>
          <p>{t('saved.empty')}</p>
          <Link to="/" className="btn primary">
            {t('saved.emptyCta')}
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <div className="bento-tile saved-empty">
          <span className="saved-empty-icon" aria-hidden="true">
            <Icon name="search" size={28} />
          </span>
          <p>{t('saved.noMatch')}</p>
        </div>
      ) : (
        <ul className="saved-grid" aria-label={t('saved.title')}>
          {shown.map((r, i) => (
            <li
              key={r.id}
              className={`saved-card${wideFirst && i === 0 ? ' wide' : ''}${i % 2 === 1 ? ' alt' : ''}`}
            >
              <Link to={`/recipe/${r.id}`} className="saved-link">
                <span className="saved-thumb" aria-hidden="true">
                  <Icon name="pot" size={26} />
                </span>
                <span className="saved-body">
                  <span className="saved-title">{r.title}</span>
                  <span className="saved-meta">
                    <span className="saved-time">
                      <Icon name="clock" size={13} />
                      {t('common.minutes', { n: r.totalMinutes })}
                    </span>
                    <span className="saved-cost">
                      {t('detail.perServing')} <b>¥{yen(costPerServing(r))}</b>
                    </span>
                  </span>
                </span>
              </Link>
              <button
                type="button"
                className={r.favorite ? 'saved-star on' : 'saved-star'}
                aria-pressed={r.favorite}
                aria-label={
                  t('saved.favoriteOf', { title: r.title })
                }
                onClick={() => r.id != null && void toggleFavorite(r.id)}
              >
                <StarGlyph />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
