import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import type { SavedRecipe } from '../types';
import { db, deleteRecipe, toggleFavorite } from '../db/db';
import { getIngredientName } from '../data/ingredients';
import { currentLang } from '../i18n';
import { RecipeCard } from '../components/RecipeCard';
import { formatAmount } from '../components/format';
import { ConfirmButton, Icon, Spinner } from '../components/ui';
import type { TFunction } from 'i18next';

function asText(r: SavedRecipe, t: TFunction): string {
  const lang = currentLang();
  return [
    r.title,
    `${t('common.minutes', { n: r.totalMinutes })} / ${t('common.servings', { n: r.servings })}`,
    '',
    `[${t('detail.ingredients')}]`,
    ...r.ingredients.map((i) => `- ${getIngredientName(i.id, lang)} ${formatAmount(i, t)}`),
    '',
    `[${t('detail.steps')}]`,
    ...r.steps.map((s, i) => `${i + 1}. ${s}`),
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
    <button type="button" className="btn link back" onClick={() => (history.length > 1 ? nav(-1) : nav('/saved'))}>
      <Icon name="back" size={18} /> {t('common.back')}
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
        {back}
        <p className="muted center pad">{t('detail.notFound')}</p>
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
      {back}
      <RecipeCard
        recipe={recipe}
        header={
          <div className="detail-top">
            {recipe.prompt && <p className="muted small prompt">{t('detail.prompt', { p: recipe.prompt })}</p>}
            <button
              type="button"
              className={recipe.favorite ? 'fav-btn on' : 'fav-btn'}
              aria-pressed={recipe.favorite}
              aria-label={recipe.favorite ? t('detail.unfavorite') : t('detail.favorite')}
              onClick={() => recipe.id != null && void toggleFavorite(recipe.id)}
            >
              <Icon name="star" filled={recipe.favorite} />
            </button>
          </div>
        }
        actions={
          <>
            <button type="button" className="btn ghost" onClick={() => void share()}>
              <Icon name="share" size={18} />
              {copied ? t('detail.copied') : t('detail.share')}
            </button>
            <ConfirmButton
              onConfirm={async () => {
                if (recipe.id != null) await deleteRecipe(recipe.id);
                nav('/saved', { replace: true });
              }}
            >
              {t('common.delete')}
            </ConfirmButton>
          </>
        }
      />
    </div>
  );
}
