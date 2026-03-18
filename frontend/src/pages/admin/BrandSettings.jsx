import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBrand } from '../../brand/BrandProvider';
import api from '../../api';
import Nav from '../../components/Navbar';
import '../../components/adminuistyles/brand-settings.css';

const COLOR_FIELDS = [
  { key: 'primaryColor', label: 'Primary Color',  hint: 'Buttons, active states'   },
  { key: 'accentColor',  label: 'Accent Color',   hint: 'Headings, highlights'      },
  { key: 'bgColor',      label: 'Background',     hint: 'Page background'           },
  { key: 'textColor',    label: 'Text Color',     hint: 'Body text'                 },
];

export default function BrandSettings() {
  const { user } = useAuth();
  const { brand, refreshBrand, previewTheme } = useBrand();

  const [name,     setName]     = useState('');
  const [logoUrl,  setLogoUrl]  = useState('');
  const [preview,  setPreview]  = useState(null);
  const [logoData, setLogoData] = useState(null); // base64 for preview only
  const [theme,    setTheme]    = useState({});
  const [msg,      setMsg]      = useState('');
  const [msgType,  setMsgType]  = useState('success');
  const [saving,   setSaving]   = useState(false);

  // Seed form from brand context once loaded
  useEffect(() => {
    if (!brand.loading) {
      setName(brand.name   || '');
      setLogoUrl(brand.logo || '');
      setPreview(brand.logo || null);
      setTheme(brand.theme  || {});
    }
  }, [brand.loading]);

  if (!user || user.role !== 'admin') {
    return (
      <>
        <Nav />
        <main className="bs-page">
          <section className="bs-box">
            <div className="bs-note bs-note--error">Unauthorized</div>
          </section>
        </main>
      </>
    );
  }

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
      setLogoData(reader.result); // only for local preview
    };
    reader.readAsDataURL(file);
  };

  const handleColorChange = (key, value) => {
    const updated = { ...theme, [key]: value };
    setTheme(updated);
    previewTheme(updated); // live preview as admin picks colors
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      await api.put('/admin/settings/brand', {
        name,
        logo_url: logoData || logoUrl || null, // base64 or existing URL
        theme,
      });
      refreshBrand(); // re-fetch and re-apply to whole app
      setMsg('Brand settings saved!');
      setMsgType('success');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to save');
      setMsgType('error');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const handleDiscard = () => {
    setName(brand.name   || '');
    setLogoUrl(brand.logo || '');
    setPreview(brand.logo || null);
    setLogoData(null);
    setTheme(brand.theme  || {});
    previewTheme(brand.theme || {}); // revert live preview
  };

  return (
    <>
      <Nav />
      <main className="bs-page">
        <header className="bs-header">
          <h1 className="bs-title">Brand Settings</h1>
          <p className="bs-subtitle">Customize your company name, logo, and theme colors.</p>
        </header>

        <div className="bs-grid">
          {/* Company name */}
          <section className="bs-box">
            <div className="bs-box__head">
              <h2 className="bs-box__title">Company Name</h2>
            </div>
            <div className="bs-box__body">
              <label className="bs-label">Name</label>
              <input
                className="bs-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Company name"
              />
            </div>
          </section>

          {/* Logo */}
          <section className="bs-box">
            <div className="bs-box__head">
              <h2 className="bs-box__title">Logo</h2>
            </div>
            <div className="bs-box__body bs-logo-row">
              <div className="bs-logo">
                {preview ? (
                  <img src={preview} alt="Logo preview" />
                ) : (
                  <div className="bs-logo__placeholder">No logo</div>
                )}
              </div>
              <div className="bs-actions">
                <label className="bs-btn bs-btn--primary">
                  Upload
                  <input type="file" accept="image/*" onChange={handleLogoChange} hidden />
                </label>
                <button className="bs-btn" onClick={handleDiscard}>Discard</button>
              </div>
            </div>
          </section>

          {/* Theme colors */}
          <section className="bs-box bs-box--full">
            <div className="bs-box__head">
              <h2 className="bs-box__title">Theme Colors</h2>
              <p className="bs-box__sub">Changes preview live as you pick colors.</p>
            </div>
            <div className="bs-box__body bs-colors-grid">
              {COLOR_FIELDS.map(({ key, label, hint }) => (
                <div key={key} className="bs-color-row">
                  <div className="bs-color-info">
                    <span className="bs-label">{label}</span>
                    <span className="bs-color-hint">{hint}</span>
                  </div>
                  <div className="bs-color-picker-wrap">
                    <input
                      type="color"
                      className="bs-color-input"
                      value={theme[key] || '#000000'}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                    />
                    <input
                      type="text"
                      className="bs-input bs-input--hex"
                      value={theme[key] || ''}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      placeholder="#000000"
                      maxLength={7}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="bs-footer">
          <button className="bs-btn bs-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button className="bs-btn" onClick={handleDiscard}>Discard</button>
          {msg && <div className={`bs-note bs-note--${msgType}`}>{msg}</div>}
        </div>
      </main>
    </>
  );
}