import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import type { SavedRecipe } from '../types';
import { db, deleteRecipe, toggleFavorite } from '../db/db';
import { getIngredientName } from '../data/ingredients';
import { currentLang } from '../i18n';
import { RecipeCard, StarGlyph } from '../components/RecipeCard';
import { formatAmount } from '../components/format';
import { renderStepsText } from '../lib/recipeText';
import { ConfirmButton, Icon, Spinner } from '../components/ui';
import type { TFunction } from 'i18next';

function asText(r: SavedRecipe, t: TFunction): string {
  const lang = currentLang();
  return [
    r.title,
    ...(r.description ? [r.description] : []),
    `${t('common.minutes', { n: r.totalMinutes })} / ${t('common.servings', { n: r.servings })}`,
    '',
    `[${t('detail.ingredients')}]`,
    ...r.ingredients.map((i) => `- ${getIngredientName(i.id, lang)} ${formatAmount(i, t)}`),
    '',
    `[${t('detail.steps')}]`,
    ...renderStepsText(r, lang, (ri) => formatAmount(ri, t, lang)).map((s, i) => `${i + 1}. ${s}`),
    ...(r.tip ? ['', `${t('detail.tip')}: ${r.tip}`] : []),
  ].join('\n');
}

export default function RecipeDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const nav = useNavigate();
  const num = Number(id);
  const [copied, setCopied] = useState(false);
  // undefined = loading, null = not found
  const recipe = useLiveQuery(
    async () => (Number.isFinite(num) ? ((await db.recipes.get(num)) ?? null) : null),
    [num],
  );

  const back = (
    <button
      type="button"
      className="recipe-icon-btn"
      aria-label={t('common.back')}
      onClick={() => (history.length > 1 ? nav(-1) : nav('/saved'))}
    >
      <Icon name="back" size={20} />
    </button>
  );

  if (recipe === undefined) {
    return (
      <div className="page center pad">
        <Spinner />
      </div>
    );
  }
  if (recipe === null) {
    return (
      <div className="page">
        <div className="recipe-topbar">{back}</div>
        <p className="bento-tile muted center">{t('detail.notFound')}</p>
        <p className="center">
          <Link to="/saved" className="btn ghost">
            {t('saved.title')}
          </Link>
        </p>
      </div>
    );
  }

  const share = async () => {
    const text = asText(recipe, t);
    try {
      if (navigator.share) {
        await navigator.share({ title: recipe.title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="page">
      <div className="recipe-topbar">
        {back}
        <div className="recipe-topbar-end">
          <span className="recipe-status" role="status">
            {copied ? t('detail.copied') : ''}
          </span>
          <button
            type="button"
            className={recipe.favorite ? 'recipe-icon-btn fav on' : 'recipe-icon-btn fav'}
            aria-pressed={recipe.favorite}
            aria-label={recipe.favorite ? t('detail.unfavorite') : t('detail.favorite')}
            onClick={() => recipe.id != null && void toggleFavorite(recipe.id)}
          >
            <StarGlyph />
          </button>
          <button
            type="button"
            className="recipe-icon-btn"
            aria-label={copied ? t('detail.copied') : t('detail.share')}
            onClick={() => void share()}
          >
            <Icon name="share" size={20} />
          </button>
          <ConfirmButton
            className="recipe-icon-btn danger"
            onConfirm={async () => {
              if (recipe.id != null) await deleteRecipe(recipe.id);
              nav('/saved', { replace: true });
            }}
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
            <span className="bento-sr">{t('common.delete')}</span>
          </ConfirmButton>
        </div>
      </div>
      <RecipeCard
        recipe={recipe}
        header={recipe.prompt ? <p className="recipe-prompt">{t('detail.prompt', { p: recipe.prompt })}</p> : undefined}
      />
    </div>
  );
}
