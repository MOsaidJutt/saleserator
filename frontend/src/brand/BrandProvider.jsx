import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const BrandCtx = createContext(null);
const NAME_KEY = 'companyName';
const LOGO_KEY = 'companyLogo';

function loadBrand() {
  return {
    name: localStorage.getItem(NAME_KEY) || 'Saleserator Academy',
    logo: localStorage.getItem(LOGO_KEY) || null,
  };
}

export function BrandProvider({ children }) {
  const [brand, setBrand] = useState(loadBrand());

  // Persist to localStorage
  useEffect(() => {
    if (brand.name !== undefined) localStorage.setItem(NAME_KEY, brand.name);
    if (brand.logo !== undefined && brand.logo !== null) {
      localStorage.setItem(LOGO_KEY, brand.logo);
    } else if (brand.logo === null) {
      localStorage.removeItem(LOGO_KEY);
    }
  }, [brand]);

  // Sync across tabs/windows
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === NAME_KEY || e.key === LOGO_KEY) setBrand(loadBrand());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(
    () => ({
      brand,
      setName: (name) => setBrand((b) => ({ ...b, name })),
      setLogo: (logo) => setBrand((b) => ({ ...b, logo })),
      setBrand,
    }),
    [brand],
  );

  return <BrandCtx.Provider value={value}>{children}</BrandCtx.Provider>;
}

export function useBrand() {
  const ctx = useContext(BrandCtx);
  if (!ctx) throw new Error('useBrand must be used within <BrandProvider>');
  return ctx;
}
