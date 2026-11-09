import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GeneratedRecipe } from '../types';
import { INGREDIENT_MAP, getIngredientName } from '../data/ingredients';
import { costPerServing, estimateCost } from '../lib/cost';
import { currentLang } from '../i18n';
import { formatAmount, yen } from './format';
import { Icon } from './ui';

export function RecipeMeta({ recipe }: { recipe: Pick<GeneratedRecipe, 'totalMinutes' | 'servings' | 'ingredients'> }) {
  const { t } = useTranslation();
  return (
    <div className="meta">
      <span className="pill">
        <Icon name="clock" size={16} />
        {t('common.minutes', { n: recipe.totalMinutes })}
      </span>
      <span className="pill">
        <Icon name="user" size={16} />
        {t('common.servings', { n: recipe.servings })}
      </span>
      <span className="pill accent">{t('common.perServing', { n: yen(costPerServing(recipe)) })}</span>
    </div>
  );
}

export function RecipeCard({
  recipe,
  actions,
  header,
}: {
  recipe: GeneratedRecipe;
  actions?: ReactNode;
  header?: ReactNode;
}) {
  const { t } = useTranslation();
  const lang = currentLang();
  const total = estimateCost(recipe);

  return (
    <article className="card recipe">
      {header}
      <h2 className="recipe-title">{recipe.title}</h2>
      <RecipeMeta recipe={recipe} />

      <section className="recipe-section">
        <div className="section-head">
          <h3>{t('detail.ingredients')}</h3>
          <span className="muted small">{t('common.total', { n: yen(total) })}</span>
        </div>
        <ul className="ing-list">
          {recipe.ingredients.map((ri, i) => {
            const pantry = !!INGREDIENT_MAP[ri.id]?.pantry;
            const c = pantry ? 0 : estimateCost({ ingredients: [ri] });
            return (
              <li key={`${ri.id}-${i}`} className="ing-row">
                <span className="ing-name">{getIngredientName(ri.id, lang)}</span>
                <span className="ing-amount">{formatAmount(ri, t)}</span>
                <span className="ing-cost">{pantry ? <span className="tag">{t('detail.pantry')}</span> : `¥${yen(c)}`}</span>
              </li>
            );
          })}
        </ul>
        <p className="muted tiny">{t('detail.costNote')}</p>
      </section>

      <section className="recipe-section">
        <h3>{t('detail.steps')}</h3>
        <ol className="steps">
          {recipe.steps.map((s, i) => (
            <li key={i}>
              <span className="step-num">{i + 1}</span>
              <p>{s}</p>
            </li>
          ))}
        </ol>
      </section>

      {recipe.tip && (
        <aside className="tip">
          <strong>{t('detail.tip')}</strong>
          <p>{recipe.tip}</p>
        </aside>
      )}

      {actions && <div className="actions">{actions}</div>}
    </article>
  );
}
