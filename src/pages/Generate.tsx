import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GenerateRequest, GeneratedRecipe } from '../types';
import { loadSettings, saveRecipe, saveSettings } from '../db/db';
import { estimateCost } from '../lib/cost';
import { CloudError, generateRecipe, isAbortError, type CloudErrorCode } from '../llm/cloud';
import { currentLang } from '../i18n';
import { IngredientPicker } from '../components/IngredientPicker';
import { RecipeCard } from '../components/RecipeCard';
import { Icon, Segmented, Spinner } from '../components/ui';

const TIMES = [10, 15, 30, 60] as const;
const SERVINGS = [1, 2, 3, 4] as const;

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

  const ready = online;
  const generating = status === 'generating';

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('generate.title')}</h1>
        <p className="muted small">{t('app.tagline')}</p>
      </header>

      {!online && (
        <div className="card offline-banner" role="status">
          {t('errors.offline')}
        </div>
      )}

      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !generating) void run();
        }}
      >
        <label className="field">
          <span className="field-label">{t('generate.promptLabel')}</span>
          <textarea
            rows={2}
            value={d.prompt}
            maxLength={300}
            placeholder={t('generate.promptPlaceholder')}
            onChange={(e) => update({ prompt: e.target.value })}
          />
        </label>
        <div className="chips scroll-x">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              className={d.prompt === ex ? 'chip on' : 'chip'}
              onClick={() => update({ prompt: ex })}
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="field">
          <span className="field-label">{t('generate.fridgeLabel')}</span>
          <IngredientPicker value={d.fridge} onChange={(fridge) => update({ fridge })} />
        </div>

        <div className="field">
          <span className="field-label">{t('generate.maxTime')}</span>
          <Segmented
            label={t('generate.maxTime')}
            value={d.maxMinutes}
            options={TIMES.map((m) => ({ value: m, label: t('common.minutes', { n: m }) }))}
            onChange={(maxMinutes) => {
              update({ maxMinutes });
              saveSettings({ maxMinutes });
            }}
          />
        </div>

        <div className="row-2">
          <div className="field">
            <span className="field-label">{t('generate.servings')}</span>
            <Segmented
              label={t('generate.servings')}
              value={d.servings}
              options={SERVINGS.map((s) => ({ value: s, label: String(s) }))}
              onChange={(servings) => {
                update({ servings });
                saveSettings({ servings });
              }}
            />
          </div>
          <label className="field">
            <span className="field-label">{t('generate.budget')}</span>
            <div className="input-prefix">
              <span>¥</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={10}
                value={d.budget}
                placeholder={t('generate.budgetPlaceholder')}
                onChange={(e) => update({ budget: e.target.value })}
              />
            </div>
          </label>
        </div>

        {generating ? (
          <div className="streaming" aria-live="polite">
            <div className="streaming-head">
              <Spinner />
              <span className="streaming-title">{t('generate.thinking')}</span>
              <span className="muted small">{t('generate.elapsed', { n: elapsed })}</span>
            </div>
            <button type="button" className="btn ghost block" onClick={cancel}>
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button type="submit" className="btn primary block lg" disabled={!ready}>
            <Icon name="sparkle" size={20} />
            {t('generate.generateBtn')}
          </button>
        )}
        {status === 'error' && (
          <p className="error" role="alert">
            {t(`errors.${errCode}`)}
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
                    ✓ {t('generate.viewSaved')}
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
