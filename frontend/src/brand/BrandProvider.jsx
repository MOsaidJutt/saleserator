import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const BrandCtx = createContext(null);
const BRAND_KEY = 'company_brand';

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

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(BRAND_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(brand) {
  try {
    localStorage.setItem(BRAND_KEY, JSON.stringify(brand));
  } catch {}
}

function clearStorage() {
  try {
    localStorage.removeItem(BRAND_KEY);
  } catch {}
}

const EMPTY_BRAND = { name: '', logo: null, theme: DEFAULT_THEME };

export function BrandProvider({ children }) {
  const { user } = useAuth();

  const [brand, setBrand] = useState(() => {
    const stored = loadFromStorage();
    if (stored) {
      applyTheme(stored.theme || DEFAULT_THEME);
      return stored;
    }
    return EMPTY_BRAND;
  });

  useEffect(() => {
    if (!user?.id) {
      // Logged out — clear
      clearStorage();
      applyTheme(DEFAULT_THEME);
      setBrand(EMPTY_BRAND);
      return;
    }

    // Check if stored brand belongs to this user
    const stored = loadFromStorage();
    if (stored?.userId === user.id) {
      // Already have it — just apply theme
      applyTheme(stored.theme || DEFAULT_THEME);
      setBrand(stored);
      return;
    }

    // Different user or no stored brand — fetch once
    api.get('/auth/brand')
      .then(({ data }) => {
        const theme = { ...DEFAULT_THEME, ...(data.theme || {}) };
        const newBrand = {
          userId:  user.id,
          name:    data.name     || '',
          logo:    data.logo_url || null,
          theme,
        };
        saveToStorage(newBrand);
        setBrand(newBrand);
        applyTheme(theme);
      })
      .catch(() => {
        applyTheme(DEFAULT_THEME);
        setBrand(EMPTY_BRAND);
      });
  }, [user?.id]);

  const refreshBrand = () => {
    if (!user?.id) return;
    api.get('/auth/brand').then(({ data }) => {
      const theme = { ...DEFAULT_THEME, ...(data.theme || {}) };
      const newBrand = {
        userId:  user.id,
        name:    data.name     || '',
        logo:    data.logo_url || null,
        theme,
      };
      saveToStorage(newBrand);
      setBrand(newBrand);
      applyTheme(theme);
    });
  };

  const value = useMemo(
    () => ({
      brand,
      refreshBrand,
      previewTheme: (theme) => applyTheme({ ...DEFAULT_THEME, ...theme }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brand],
  );

  return <BrandCtx.Provider value={value}>{children}</BrandCtx.Provider>;
}

export function useBrand() {
  const ctx = useContext(BrandCtx);
  if (!ctx) throw new Error('useBrand must be used within <BrandProvider>');
  return ctx;
}