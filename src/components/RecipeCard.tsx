import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GeneratedRecipe } from '../types';
import { INGREDIENT_MAP, getIngredientName } from '../data/ingredients';
import { costPerServing, estimateCost } from '../lib/cost';
import { currentLang } from '../i18n';
import { formatAmount, yen } from './format';
import { renderSteps, scaleRecipe } from '../lib/recipeText';
import { Icon } from './ui';

function Glyph({ d, size = 18, width = 2.4 }: { d: string; size?: number; width?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/** Star with yolk fill when pressed (colors come from CSS). */
export function StarGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg
      className="star-glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  );
}

const MINUS = 'M6 12h12';
const PLUS = 'M6 12h12M12 6v12';
const INFO = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.5v.5';
const BULB = 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z';

/** Row of three bento stat tiles: time, servings (optional stepper), cost per serving. */
export function RecipeMeta({
  recipe,
  onServings,
}: {
  recipe: Pick<GeneratedRecipe, 'totalMinutes' | 'servings' | 'ingredients'>;
  /** When given, servings becomes a −/+ stepper that rescales all amounts. */
  onServings?: (n: number) => void;
}) {
  const { t } = useTranslation();
  const servId = useId();
  return (
    <div className="bento-stats">
      <div className="bento-stat">
        <span className="bento-stat-label">
          <Icon name="clock" size={14} />
          {t('detail.time')}
        </span>
        <span className="bento-stat-value">{t('common.minutes', { n: recipe.totalMinutes })}</span>
      </div>

      <div className="bento-stat tint">
        <span className="bento-stat-label" id={servId}>
          {t('detail.servingsAdjust')}
        </span>
        {onServings ? (
          <div className="bento-stepper" role="group" aria-labelledby={servId}>
            <button
              type="button"
              className="bento-step-btn"
              aria-label={t('detail.fewer')}
              disabled={recipe.servings <= 1}
              onClick={() => onServings(recipe.servings - 1)}
            >
              <Glyph d={MINUS} />
            </button>
            <output className="bento-stat-value" aria-live="polite">
              {recipe.servings}
            </output>
            <button
              type="button"
              className="bento-step-btn plus"
              aria-label={t('detail.more')}
              disabled={recipe.servings >= 8}
              onClick={() => onServings(recipe.servings + 1)}
            >
              <Glyph d={PLUS} />
            </button>
          </div>
        ) : (
          <span className="bento-stat-value">{t('common.servings', { n: recipe.servings })}</span>
        )}
      </div>

      <div className="bento-stat yolk">
        <span className="bento-stat-label">{t('detail.perServing')}</span>
        <span className="bento-stat-value">
          <span className="bento-yen">¥</span>
          {yen(costPerServing(recipe))}
        </span>
      </div>
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
  const uid = useId();
  const [servings, setServings] = useState(recipe.servings);
  const shown = scaleRecipe(recipe, servings);
  const total = estimateCost(shown);
  const steps = renderSteps(shown, lang);

  const rows = shown.ingredients.map((ri, i) => {
    const pantry = !!INGREDIENT_MAP[ri.id]?.pantry;
    return { ri, i, pantry, cost: pantry ? 0 : estimateCost({ ingredients: [ri] }) };
  });
  const buy = rows.filter((r) => !r.pantry);
  const stock = rows.filter((r) => r.pantry);

  const renderRows = (list: typeof rows) =>
    list.map(({ ri, i, pantry, cost }) => (
      <li key={`${ri.id}-${i}`} className="bento-ing-row">
        <span className="bento-ing-name">{getIngredientName(ri.id, lang)}</span>
        <span className="bento-ing-amount">{formatAmount(ri, t)}</span>
        <span className="bento-ing-cost">
          {pantry ? <span className="bento-tag">{t('detail.pantry')}</span> : `¥${yen(cost)}`}
        </span>
      </li>
    ));

  return (
    <article className="bento recipe">
      <section className="bento-tile bento-title-tile">
        {header}
        <h2 className="recipe-title">{recipe.title}</h2>
        {recipe.description && <p className="recipe-desc">{recipe.description}</p>}
      </section>

      <RecipeMeta recipe={shown} onServings={setServings} />

      <section className="bento-tile" aria-labelledby={`${uid}-ing`}>
        <div className="bento-head">
          <h3 id={`${uid}-ing`} className="bento-h">
            {t('detail.ingredients')}
            <span className="bento-h-sub">{t('common.servings', { n: shown.servings })}</span>
          </h3>
          <span className="bento-badge">{t('common.total', { n: yen(total) })}</span>
        </div>
        {buy.length > 0 && (
          <ul className="bento-ing buy" aria-label={t('detail.toBuy')}>
            {renderRows(buy)}
          </ul>
        )}
        {stock.length > 0 && (
          <ul className="bento-ing stock" aria-label={t('detail.pantryList')}>
            {renderRows(stock)}
          </ul>
        )}
        <p className="bento-note">
          <Glyph d={INFO} size={14} width={2.2} />
          {t('detail.costNote')}
        </p>
      </section>

      <section className="bento-tile" aria-labelledby={`${uid}-steps`}>
        <div className="bento-head">
          <h3 id={`${uid}-steps`} className="bento-h">
            {t('detail.steps')}
          </h3>
          <span className="bento-head-meta">{t('detail.stepCount', { n: steps.length })}</span>
        </div>
        <ol className="bento-steps">
          {steps.map((parts, i) => (
            <li key={i}>
              <span className="bento-step-num" aria-hidden="true">
                {i + 1}
              </span>
              <p>
                {parts.map((p, j) =>
                  'text' in p ? (
                    <span key={j}>{p.text}</span>
                  ) : (
                    <span key={j}>
                      <span className="step-ing">{p.name}</span>
                      {p.amount && (
                        <span className="step-amt">
                          {lang === 'ja'
                            ? `（${formatAmount(p.amount, t, lang)}）`
                            : ` (${formatAmount(p.amount, t, lang)})`}
                        </span>
                      )}
                    </span>
                  ),
                )}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {recipe.tip && (
        <aside className="bento-tile bento-tip">
          <span className="bento-tip-icon" aria-hidden="true">
            <Glyph d={BULB} size={20} width={2} />
          </span>
          <div>
            <p className="bento-tip-title">{t('detail.tip')}</p>
            <p className="bento-tip-body">{recipe.tip}</p>
          </div>
        </aside>
      )}

      {actions && <div className="actions bento-actions">{actions}</div>}
    </article>
  );
}
