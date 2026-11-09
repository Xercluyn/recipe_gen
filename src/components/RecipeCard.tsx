import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GeneratedRecipe } from '../types';
import { INGREDIENT_MAP, getIngredientName } from '../data/ingredients';
import { costPerServing, estimateCost } from '../lib/cost';
import { currentLang } from '../i18n';
import { formatAmount, yen } from './format';
import { renderSteps, scaleRecipe } from '../lib/recipeText';
import { Icon } from './ui';

export function RecipeMeta({
  recipe,
  onServings,
}: {
  recipe: Pick<GeneratedRecipe, 'totalMinutes' | 'servings' | 'ingredients'>;
  /** When given, servings becomes a −/+ stepper that rescales all amounts. */
  onServings?: (n: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="meta">
      <span className="pill">
        <Icon name="clock" size={16} />
        {t('common.minutes', { n: recipe.totalMinutes })}
      </span>
      {onServings ? (
        <span className="pill stepper" role="group" aria-label={t('detail.servingsAdjust')}>
          <button
            type="button"
            aria-label={t('detail.fewer')}
            disabled={recipe.servings <= 1}
            onClick={() => onServings(recipe.servings - 1)}
          >
            −
          </button>
          <Icon name="user" size={16} />
          {t('common.servings', { n: recipe.servings })}
          <button
            type="button"
            aria-label={t('detail.more')}
            disabled={recipe.servings >= 8}
            onClick={() => onServings(recipe.servings + 1)}
          >
            +
          </button>
        </span>
      ) : (
        <span className="pill">
          <Icon name="user" size={16} />
          {t('common.servings', { n: recipe.servings })}
        </span>
      )}
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
  const [servings, setServings] = useState(recipe.servings);
  const shown = scaleRecipe(recipe, servings);
  const total = estimateCost(shown);
  const steps = renderSteps(shown, lang);

  return (
    <article className="card recipe">
      {header}
      <h2 className="recipe-title">{recipe.title}</h2>
      {recipe.description && <p className="recipe-desc">{recipe.description}</p>}
      <RecipeMeta recipe={shown} onServings={setServings} />

      <section className="recipe-section">
        <div className="section-head">
          <h3>{t('detail.ingredients')}</h3>
          <span className="muted small">{t('common.total', { n: yen(total) })}</span>
        </div>
        <ul className="ing-list">
          {shown.ingredients.map((ri, i) => {
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
          {steps.map((parts, i) => (
            <li key={i}>
              <span className="step-num">{i + 1}</span>
              <p>
                {parts.map((p, j) =>
                  'text' in p ? (
                    <span key={j}>{p.text}</span>
                  ) : (
                    <span key={j} className="step-ing">
                      {p.name}
                      {p.amount && <span className="step-amt">{lang === 'ja' ? `（${formatAmount(p.amount, t, lang)}）` : ` (${formatAmount(p.amount, t, lang)})`}</span>}
                    </span>
                  ),
                )}
              </p>
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
