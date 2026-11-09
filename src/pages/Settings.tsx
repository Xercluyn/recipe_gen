import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lang } from '../types';
import { exportAll, importAll, loadSettings, saveSettings } from '../db/db';
import { currentLang, setLanguage } from '../i18n';
import { formatBytes } from '../components/format';
import { BentoLogo, Icon, ProgressBar, Segmented, Stepper } from '../components/ui';

interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean | null;
}

export default function Settings() {
  const { t } = useTranslation();
  const lang = currentLang();
  const [settings, setSettings] = useState(loadSettings);
  const [storage, setStorage] = useState<StorageInfo | null | undefined>(undefined);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshStorage = async () => {
    try {
      if (!navigator.storage?.estimate) return setStorage(null);
      const e = await navigator.storage.estimate();
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
      setStorage({ usage: e.usage ?? 0, quota: e.quota ?? 0, persisted });
    } catch {
      setStorage(null);
    }
  };
  useEffect(() => {
    void refreshStorage();
  }, []);

  const update = (patch: Parameters<typeof saveSettings>[0]) => setSettings(saveSettings(patch));

  const doExport = async () => {
    const json = await exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recipe-gen-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const doImport = async (file: File) => {
    try {
      const n = await importAll(await file.text());
      setMsg({ ok: true, text: t('settings.imported', { n }) });
    } catch {
      setMsg({ ok: false, text: t('settings.importFailed') });
    }
  };

  const uid = useId();
  const ids = {
    lang: `${uid}-lang`,
    ai: `${uid}-ai`,
    defaults: `${uid}-defaults`,
    time: `${uid}-time`,
    people: `${uid}-people`,
    storage: `${uid}-storage`,
    backup: `${uid}-backup`,
    a2hs: `${uid}-a2hs`,
    about: `${uid}-about`,
  };

  const steps = t('settings.a2hsSteps', { returnObjects: true }) as unknown as string[];

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('settings.title')}</h1>
        <BentoLogo />
      </header>

      <section className="tile" aria-labelledby={ids.lang}>
        <h2 id={ids.lang} className="tile-title">
          <Icon name="globe" size={18} />
          {t('settings.language')}
        </h2>
        <Segmented<'auto' | Lang>
          label={t('settings.language')}
          value={settings.lang ?? 'auto'}
          options={[
            { value: 'auto', label: lang === 'ja' ? '自動' : 'Auto' },
            { value: 'ja', label: '日本語' },
            { value: 'en', label: 'English' },
          ]}
          onChange={(v) => {
            const pref = v === 'auto' ? null : v;
            setLanguage(pref);
            setSettings(loadSettings());
          }}
        />
        {settings.lang === null && <p className="muted tiny">{t('settings.langAuto')}</p>}
      </section>

      <div className="bento-stack">
        <section className="tile" aria-labelledby={ids.defaults}>
          <h2 id={ids.defaults} className="tile-title">
            <Icon name="sliders" size={18} />
            {t('settings.defaults')}
          </h2>
          <div className="field">
            <span className="field-label" id={ids.time}>
              {t('generate.maxTime')}
            </span>
            <Segmented
              label={t('generate.maxTime')}
              value={settings.maxMinutes}
              options={[10, 15, 30, 60].map((n) => ({ value: n, label: t('common.minutes', { n }) }))}
              onChange={(maxMinutes) => update({ maxMinutes })}
            />
          </div>
          <div className="field">
            <span className="field-label" id={ids.people}>
              {t('generate.servings')}
            </span>
            <div className="tile yolk compact">
              <Stepper
                labelledBy={ids.people}
                value={settings.servings}
                min={1}
                max={4}
                decLabel={t('generate.fewer')}
                incLabel={t('generate.more')}
                onChange={(servings) => update({ servings })}
              >
                <span className="num">{settings.servings}</span>
                <span className="unit">{t('generate.servingsUnit', { count: settings.servings })}</span>
              </Stepper>
            </div>
          </div>
        </section>

        <section className="tile green" aria-labelledby={ids.ai}>
          <h2 id={ids.ai} className="tile-title">
            <Icon name="sparkle" size={18} />
            {t('settings.ai')}
          </h2>
          <p className="small">{t('settings.aiProvider')}</p>
          <p className="muted small">{t('settings.aiPrivacy')}</p>
        </section>

        <section className="tile" aria-labelledby={ids.storage}>
          <h2 id={ids.storage} className="tile-title">
            <Icon name="box" size={18} />
            {t('settings.storage')}
          </h2>
          {storage === undefined ? null : storage === null ? (
            <p className="muted small">{t('settings.storageUnknown')}</p>
          ) : (
            <>
              <ProgressBar
                value={storage.quota ? storage.usage / storage.quota : 0}
                label={t('settings.storageUsed', {
                  used: formatBytes(storage.usage),
                  quota: formatBytes(storage.quota),
                })}
              />
              {storage.persisted !== null && (
                <p className="muted tiny">
                  {storage.persisted ? t('settings.persisted') : t('settings.notPersisted')}
                </p>
              )}
            </>
          )}
        </section>

        <section className="tile" aria-labelledby={ids.backup}>
          <h2 id={ids.backup} className="tile-title">
            <Icon name="download" size={18} />
            {t('settings.backup')}
          </h2>
          <p className="muted small">{t('settings.backupDesc')}</p>
          <div className="actions settings-actions">
            <button type="button" className="btn ghost" onClick={() => void doExport()}>
              {t('settings.export')}
            </button>
            <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
              {t('settings.import')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void doImport(f);
                e.target.value = '';
              }}
            />
          </div>
          {msg && (
            <p className={msg.ok ? 'success' : 'error'} role={msg.ok ? 'status' : 'alert'}>
              {msg.text}
            </p>
          )}
        </section>

        <section className="tile yolk" aria-labelledby={ids.a2hs}>
          <h2 id={ids.a2hs} className="tile-title">
            <Icon name="share" size={18} />
            {t('settings.a2hs')}
          </h2>
          <ol className="num-steps">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>

        <section className="tile" aria-labelledby={ids.about}>
          <h2 id={ids.about} className="tile-title">
            <Icon name="info" size={18} />
            {t('settings.about')}
          </h2>
          <p className="small">{t('settings.aboutText')}</p>
        </section>
      </div>
    </div>
  );
}
