import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Lang } from '../types';
import { loadSettings, saveSettings } from '../db/db';
import ja from './ja.json';
import en from './en.json';

export function detectDeviceLang(): Lang {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of langs) {
      const s = (l || '').toLowerCase();
      if (s.startsWith('ja')) return 'ja';
      if (s.startsWith('en')) return 'en';
    }
    return 'en';
  } catch {
    return 'ja';
  }
}

export function resolveLang(): Lang {
  return loadSettings().lang ?? detectDeviceLang();
}

function applyHtmlLang(l: Lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

const initial = resolveLang();

void i18n.use(initReactI18next).init({
  resources: { ja: { translation: ja }, en: { translation: en } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
applyHtmlLang(initial);

/** Save a language preference (null = auto-detect) and apply it immediately. */
export function setLanguage(pref: Lang | null): void {
  saveSettings({ lang: pref });
  const l = pref ?? detectDeviceLang();
  void i18n.changeLanguage(l);
  applyHtmlLang(l);
}

export function currentLang(): Lang {
  return i18n.language?.startsWith('en') ? 'en' : 'ja';
}

export default i18n;
