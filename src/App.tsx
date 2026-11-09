import { lazy, Suspense } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Generate from './pages/Generate';
import { Icon, Spinner } from './components/ui';

const Saved = lazy(() => import('./pages/Saved'));
const RecipeDetail = lazy(() => import('./pages/RecipeDetail'));
const Settings = lazy(() => import('./pages/Settings'));

export default function App() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const tab = ({ isActive }: { isActive: boolean }) => (isActive ? 'tab on' : 'tab');

  return (
    <div className="app">
      <main className="main">
        <Suspense
          fallback={
            <div className="page center pad">
              <Spinner />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Generate />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/recipe/:id" element={<RecipeDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <nav className="tabbar" aria-label={t('common.mainMenu')}>
        <NavLink to="/" end className={tab}>
          <span className="tab-ico">
            <Icon name="pot" />
          </span>
          <span>{t('tabs.generate')}</span>
        </NavLink>
        <NavLink to="/saved" className={({ isActive }) => tab({ isActive: isActive || pathname.startsWith('/recipe/') })}>
          <span className="tab-ico">
            <Icon name="bookmark" />
          </span>
          <span>{t('tabs.saved')}</span>
        </NavLink>
        <NavLink to="/settings" className={tab}>
          <span className="tab-ico">
            <Icon name="sliders" />
          </span>
          <span>{t('tabs.settings')}</span>
        </NavLink>
      </nav>
    </div>
  );
}
