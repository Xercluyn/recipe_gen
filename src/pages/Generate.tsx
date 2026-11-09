import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GenerateRequest, GeneratedRecipe } from '../types';
import { loadSettings, saveRecipe, saveSettings } from '../db/db';
import { estimateCost } from '../lib/cost';
import { CloudError, generateRecipe, isAbortError, type CloudErrorCode } from '../llm/cloud';
import { currentLang } from '../i18n';
import { IngredientPicker } from '../components/IngredientPicker';
import { RecipeCard } from '../components/RecipeCard';
import { BentoHop, BentoLogo, Icon, Segmented, Stepper } from '../components/ui';

const TIMES = [10, 15, 30, 60] as const;
const MIN_SERVINGS = 1;
const MAX_SERVINGS = 4;

interface Draft {
  prompt: string;
  fridge: string[];
  maxMinutes: number;
  servings: number;
  budget: string;
  result: GeneratedRecipe | null;
  resultReq: GenerateRequest | null;
  savedId: number | null;
}

// Survives tab switches within the session.
let draft: Draft | null = null;
function initialDraft(): Draft {
  if (draft) return draft;
  const s = loadSettings();
  return {
    prompt: '',
    fridge: [],
    maxMinutes: s.maxMinutes,
    servings: s.servings,
    budget: '',
    result: null,
    resultReq: null,
    savedId: null,
  };
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export default function Generate() {
  const { t } = useTranslation();
  const lang = currentLang();
  const online = useOnline();
  const [d, setD] = useState<Draft>(initialDraft);
  const [status, setStatus] = useState<'idle' | 'generating' | 'error'>('idle');
  const [errCode, setErrCode] = useState<CloudErrorCode>('failed');
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    draft = d;
  }, [d]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (status !== 'generating') return;
    const t0 = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [status]);

  const update = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));
  const examples = t('generate.examples', { returnObjects: true }) as unknown as string[];

  const budgetNum = Number(d.budget);
  const buildReq = (): GenerateRequest => ({
    prompt: d.prompt.trim() || t('generate.defaultPrompt'),
    lang,
    fridge: d.fridge,
    maxMinutes: d.maxMinutes,
    servings: d.servings,
    ...(d.budget && budgetNum > 0 ? { budgetPerServingYen: Math.round(budgetNum) } : {}),
  });

  const run = async (req: GenerateRequest = buildReq()) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus('generating');
    try {
      const r = await generateRecipe(req, { signal: ac.signal });
      if (ac.signal.aborted) return;
      update({ result: r, resultReq: req, savedId: null });
      setStatus('idle');
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      if (ac.signal.aborted || isAbortError(e)) {
        if (abortRef.current === ac) setStatus('idle');
      } else {
        console.error(e);
        setErrCode(e instanceof CloudError ? e.code : 'failed');
        setStatus('error');
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setStatus('idle');
  };

  const save = async () => {
    if (!d.result) return;
    const req = d.resultReq ?? buildReq();
    const id = await saveRecipe({
      ...d.result,
      lang: req.lang,
      prompt: req.prompt,
      costYen: Math.round(estimateCost(d.result)),
      favorite: false,
      createdAt: Date.now(),
    });
    update({ savedId: id });
  };

  const uid = useId();
  const ids = {
    prompt: `${uid}-prompt`,
    fridge: `${uid}-fridge`,
    time: `${uid}-time`,
    people: `${uid}-people`,
    budget: `${uid}-budget`,
  };
  const ready = online;
  const generating = status === 'generating';

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{t('generate.heading')}</h1>
          <p className="muted small">{t('app.tagline')}</p>
        </div>
        <BentoLogo />
      </header>

      {!online && (
        <div className="card offline-banner" role="status">
          <Icon name="wifiOff" size={20} />
          <span>{t('errors.offline')}</span>
        </div>
      )}

      <form
        className="bento-stack"
        aria-label={t('generate.title')}
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !generating) void run();
        }}
      >
        <section className="tile">
          <label htmlFor={ids.prompt} className="tile-title">
            <Icon name="sparkle" size={18} />
            {t('generate.promptLabel')}
          </label>
          <textarea
            id={ids.prompt}
            rows={2}
            value={d.prompt}
            maxLength={300}
            placeholder={t('generate.promptPlaceholder')}
            onChange={(e) => update({ prompt: e.target.value })}
          />
          <div className="chips scroll-x" role="group" aria-label={t('generate.examplesLabel')}>
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                className={d.prompt === ex ? 'chip yolk on' : 'chip yolk'}
                aria-pressed={d.prompt === ex}
                onClick={() => update({ prompt: ex })}
              >
                {ex}
              </button>
            ))}
          </div>
        </section>

        <section className="tile green" aria-labelledby={ids.fridge}>
          <div className="tile-head">
            <h2 id={ids.fridge} className="tile-title">
              <Icon name="fridge" size={18} />
              {t('generate.fridgeLabel')}
            </h2>
            {d.fridge.length > 0 && (
              <span className="badge">{t('generate.selectedCount', { n: d.fridge.length })}</span>
            )}
          </div>
          <IngredientPicker value={d.fridge} onChange={(fridge) => update({ fridge })} />
        </section>

        <div className="bento-grid">
          <section className="tile span-2" aria-labelledby={ids.time}>
            <div className="tile-head">
              <h2 id={ids.time} className="tile-title">
                <Icon name="timer" size={18} />
                {t('generate.maxTime')}
              </h2>
              <span className="tile-meta">{t('generate.timeHint')}</span>
            </div>
            <Segmented
              label={t('generate.maxTime')}
              value={d.maxMinutes}
              options={TIMES.map((m) => ({ value: m, label: t('common.minutes', { n: m }) }))}
              onChange={(maxMinutes) => {
                update({ maxMinutes });
                saveSettings({ maxMinutes });
              }}
            />
          </section>

          <section className="tile yolk compact" aria-labelledby={ids.people}>
            <h2 id={ids.people} className="tile-title">
              <Icon name="users" size={18} />
              {t('generate.servings')}
            </h2>
            <Stepper
              labelledBy={ids.people}
              value={d.servings}
              min={MIN_SERVINGS}
              max={MAX_SERVINGS}
              decLabel={t('generate.fewer')}
              incLabel={t('generate.more')}
              onChange={(servings) => {
                update({ servings });
                saveSettings({ servings });
              }}
            >
              <span className="num">{d.servings}</span>
              <span className="unit">{t('generate.servingsUnit', { count: d.servings })}</span>
            </Stepper>
          </section>

          <section className="tile compact">
            <div className="tile-head">
              <label htmlFor={ids.budget} className="tile-title">
                <span>
                  {t('generate.budgetShort')}
                  <span className="sub">{t('generate.perServing')}</span>
                </span>
              </label>
              <span className="badge outline">{t('generate.optional')}</span>
            </div>
            <div className="amount">
              <span className="amount-unit" aria-hidden="true">
                ¥
              </span>
              <input
                id={ids.budget}
                type="number"
                inputMode="numeric"
                min={0}
                step={10}
                value={d.budget}
                placeholder={t('generate.budgetPlaceholder')}
                onChange={(e) => update({ budget: e.target.value })}
              />
              {d.budget !== '' && <span className="amount-suffix">{t('generate.budgetMax')}</span>}
            </div>
          </section>
        </div>

        {generating ? (
          <div className="streaming" aria-live="polite">
            <div className="streaming-head">
              <BentoHop />
              <span className="streaming-title">{t('generate.thinking')}</span>
              <span className="streaming-time">{t('generate.elapsed', { n: elapsed })}</span>
            </div>
            <button type="button" className="btn ghost block" onClick={cancel}>
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button type="submit" className="btn primary block lg" disabled={!ready}>
            <Icon name="sparkle" size={22} />
            {t('generate.generateBtn')}
          </button>
        )}
        {status === 'error' && (
          <p className="alert" role="alert">
            <Icon name="alert" size={18} />
            <span>{t(`errors.${errCode}`)}</span>
          </p>
        )}
      </form>

      <div ref={resultRef}>
        {d.result && !generating && (
          <RecipeCard
            key={`${d.result.title}-${d.result.steps.length}-${d.result.ingredients.length}`}
            recipe={d.result}
            actions={
              <>
                {d.savedId != null ? (
                  <Link className="btn primary" to={`/recipe/${d.savedId}`}>
                    <Icon name="check" size={18} stroke={2.5} />
                    {t('generate.viewSaved')}
                  </Link>
                ) : (
                  <button type="button" className="btn primary" onClick={() => void save()}>
                    <Icon name="bookmark" size={18} />
                    {t('generate.save')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn ghost"
                  disabled={!ready}
                  onClick={() => void run()}
                >
                  {t('generate.regenerate')}
                </button>
              </>
            }
          />
        )}
      </div>
    </div>
  );
}
