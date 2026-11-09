import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GenerateRequest, GeneratedRecipe } from '../types';
import { loadSettings, saveRecipe, saveSettings } from '../db/db';
import { estimateCost } from '../lib/cost';
import { MODELS } from '../llm/models';
import { currentLang } from '../i18n';
import { useModelState } from '../hooks/useModel';
import { IngredientPicker } from '../components/IngredientPicker';
import { ModelSetup, NoWebGPU } from '../components/ModelSetup';
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

/** Pull a readable title out of partially-streamed JSON. */
function peekTitle(partial: string): string | null {
  const m = partial.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"?/);
  return m ? m[1] : null;
}

export default function Generate() {
  const { t } = useTranslation();
  const lang = currentLang();
  const model = useModelState();
  const [d, setD] = useState<Draft>(initialDraft);
  const [status, setStatus] = useState<'idle' | 'generating' | 'error'>('idle');
  const [partial, setPartial] = useState('');
  const [tokens, setTokens] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    draft = d;
  }, [d]);
  useEffect(() => () => abortRef.current?.abort(), []);

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
    setPartial('');
    setTokens(0);
    let n = 0;
    try {
      const { generateRecipe } = await import('../llm/generate');
      const r = await generateRecipe(req, {
        signal: ac.signal,
        onToken: (p) => {
          n += 1;
          setTokens(n);
          setPartial(p);
        },
      });
      if (ac.signal.aborted) return;
      update({ result: r, resultReq: req, savedId: null });
      setStatus('idle');
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      if (ac.signal.aborted) {
        setStatus('idle');
      } else {
        console.error(e);
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

  const ready = model.webgpu === true && model.loaded !== null;
  const generating = status === 'generating';

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('generate.title')}</h1>
        <p className="muted small">{t('app.tagline')}</p>
      </header>

      {model.webgpu === false ? <NoWebGPU /> : !ready && <ModelSetup />}

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
              <span className="streaming-title">{peekTitle(partial) || t('generate.generating')}</span>
              <span className="muted small">{t('generate.tokens', { n: tokens })}</span>
            </div>
            {partial && <pre className="streaming-tail">{partial.slice(-180)}</pre>}
            <button type="button" className="btn ghost block" onClick={cancel}>
              {t('generate.stop')}
            </button>
          </div>
        ) : (
          <button type="submit" className="btn primary block lg" disabled={!ready}>
            <Icon name="sparkle" size={20} />
            {t('generate.generateBtn')}
          </button>
        )}
        {ready && model.loaded && (
          <p className="muted tiny center">{t('generate.modelInUse', { name: MODELS[model.loaded].label[lang] })}</p>
        )}
        {status === 'error' && <p className="error">{t('generate.failed')}</p>}
      </form>

      <div ref={resultRef}>
        {d.result && !generating && (
          <RecipeCard
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
