import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const BrandCtx = createContext(null);

const DEFAULT_THEME = {
  primaryColor: '#4c51bf',
  accentColor:  '#00c1de',
  bgColor:      '#0a0f1e',
  textColor:    '#f1f5f9',
};

function applyTheme(theme) {
  const t = { ...DEFAULT_THEME, ...theme };
  const root = document.documentElement;
  root.style.setProperty('--color-primary', t.primaryColor);
  root.style.setProperty('--color-accent',  t.accentColor);
  root.style.setProperty('--color-bg',      t.bgColor);
  root.style.setProperty('--color-text',    t.textColor);
}

const EMPTY_BRAND = {
  name:    '',
  logo:    null,
  theme:   DEFAULT_THEME,
  loading: false,
};

export function BrandProvider({ children }) {
  const { user } = useAuth();
  const [brand, setBrand] = useState(EMPTY_BRAND);

  const loadBrand = useCallback(() => {
    api.get('/auth/brand')
      .then(({ data }) => {
        const theme = { ...DEFAULT_THEME, ...(data.theme || {}) };
        setBrand({
          name:    data.name     || '',
          logo:    data.logo_url || null,
          theme,
          loading: false,
        });
        applyTheme(theme);
      })
      .catch(() => {
        applyTheme(DEFAULT_THEME);
        setBrand(EMPTY_BRAND);
      });
  }, []);

  useEffect(() => {
    if (!user) {
      // logged out — clear everything
      applyTheme(DEFAULT_THEME);
      setBrand(EMPTY_BRAND);
      return;
    }
    // user changed (different company) — reset then fetch fresh
    setBrand({ ...EMPTY_BRAND, loading: true });
    loadBrand();
  }, [user?.id]);

  const value = useMemo(() => ({
    brand,
    refreshBrand: loadBrand,
    previewTheme: (theme) => applyTheme({ ...DEFAULT_THEME, ...theme }),
  }), [brand, loadBrand]);

  return <BrandCtx.Provider value={value}>{children}</BrandCtx.Provider>;
}

export function useBrand() {
  const ctx = useContext(BrandCtx);
  if (!ctx) throw new Error('useBrand must be used within <BrandProvider>');
  return ctx;
}