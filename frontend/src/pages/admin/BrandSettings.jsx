import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBrand } from '../../brand/BrandProvider';
import Nav from '../../components/Navbar'; // navbar like other pages
import '../../components/adminuistyles/brand-settings.css'; // page-scoped styles

export default function BrandSettings() {
  const { user } = useAuth();
  const { brand, setName, setLogo } = useBrand();

  const [name, setNameLocal] = useState(brand.name);
  const [preview, setPreview] = useState(brand.logo);
  const [logoData, setLogoData] = useState(brand.logo);
  const [msg, setMsg] = useState('');

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
      setLogoData(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setName(name); // live update navbar
    setLogo(logoData || null); // live update navbar
    setMsg('Saved.');
    setTimeout(() => setMsg(''), 1500);
  };

  const handleDiscard = () => {
    setPreview(brand.logo);
    setLogoData(brand.logo);
    setNameLocal(brand.name);
  };

  return (
    <>
      <Nav />
      <main className="bs-page">
        <header className="bs-header">
          <h1 className="bs-title">Brand Settings</h1>
          <p className="bs-subtitle">Update your company name and logo.</p>
        </header>

        <div className="bs-grid">
          {/* Company name box */}
          <section className="bs-box">
            <div className="bs-box__head">
              <h2 className="bs-box__title">Company Name</h2>
            </div>
            <div className="bs-box__body">
              <label className="bs-label">Name</label>
              <input
                className="bs-input"
                value={name}
                onChange={(e) => setNameLocal(e.target.value)}
                placeholder="Company name"
              />
            </div>
          </section>

          {/* Logo box */}
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
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    hidden
                  />
                </label>
                <button className="bs-btn" onClick={handleDiscard}>
                  Discard
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="bs-footer">
          <button className="bs-btn bs-btn--primary" onClick={handleSave}>
            Save changes
          </button>
          {msg && <div className="bs-note bs-note--success">{msg}</div>}
        </div>
      </main>
    </>
  );
}
