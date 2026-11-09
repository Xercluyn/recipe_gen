import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelKey } from '../types';
import { MODELS } from '../llm/models';
import { loadSettings, saveSettings } from '../db/db';
import { currentLang } from '../i18n';
import { startLoad, useModelState } from '../hooks/useModel';
import { ProgressBar, Spinner } from './ui';

export function NoWebGPU() {
  const { t } = useTranslation();
  return (
    <div className="card notice warn">
      <h2>{t('model.noWebGPU')}</h2>
      <p>{t('model.noWebGPUDesc')}</p>
    </div>
  );
}

/** Card shown on the Generate page until a model is loaded. */
export function ModelSetup() {
  const { t } = useTranslation();
  const lang = currentLang();
  const m = useModelState();
  const [key, setKey] = useState<ModelKey>(() => loadSettings().modelKey);

  if (m.webgpu === null) {
    return (
      <div className="card notice">
        <Spinner /> {t('model.checking')}
      </div>
    );
  }
  if (!m.webgpu) return <NoWebGPU />;

  const choose = (k: ModelKey) => {
    setKey(k);
    saveSettings({ modelKey: k });
  };
  const cached = !!m.cached[key];

  return (
    <div className="card model-setup">
      <h2>{t('model.title')}</h2>
      <p className="muted">{t('model.desc')}</p>

      <div className="model-options" role="radiogroup">
        {(Object.keys(MODELS) as ModelKey[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={key === k}
            disabled={!!m.loading}
            className={key === k ? 'model-opt on' : 'model-opt'}
            onClick={() => choose(k)}
          >
            <span className="model-name">{MODELS[k].label[lang]}</span>
            <span className="muted small">
              {t('model.size', { n: MODELS[k].sizeMB.toLocaleString() })}
              {m.cached[k] ? ` · ${t('model.cached')}` : ''}
            </span>
          </button>
        ))}
      </div>

      {m.loading ? (
        <ProgressBar value={m.progress?.progress ?? 0} label={m.progress?.text || t('model.loadingModel')} />
      ) : (
        <>
          {!cached && <p className="hint">{t('model.wifi')}</p>}
          <button type="button" className="btn primary block" onClick={() => void startLoad(key)}>
            {cached ? t('model.load') : t('model.download')}
          </button>
        </>
      )}
      {m.error && <p className="error">{t('model.failed', { msg: m.error })}</p>}
    </div>
  );
}
