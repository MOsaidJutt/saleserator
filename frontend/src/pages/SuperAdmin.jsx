import React, { useState, useEffect } from 'react';
import api from '../api';
import '../components/SuperAdmin.css';

export default function SuperAdmin() {
  const [companies, setCompanies] = useState([]);
  const [admins, setAdmins] = useState([]);

  // Create Company
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [tagline, setTagline] = useState('');

  // Create Admin
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminCompanyId, setAdminCompanyId] = useState('');

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' | 'error'

  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);

  // Pagination
  const [currentCompanyPage, setCurrentCompanyPage] = useState(1);
  const [currentAdminPage, setCurrentAdminPage] = useState(1);
  const companiesPerPage = 5;
  const adminsPerPage = 5;

  useEffect(() => {
    fetchCompanies();
    fetchAdmins();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/superadmin/companies');
      setCompanies(response.data || []);
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await api.get('/superadmin/admins');
      setAdmins(response.data || []);
    } catch (err) {
      console.error('Error fetching admins:', err);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await api.post('/superadmin/create-company', {
        name: companyName,
        logo_url: logoUrl,
        tagline,
      });
      showMessage(res.data.message || `Company "${companyName}" created successfully!`, 'success');
      setCompanyName('');
      setLogoUrl('');
      setTagline('');
      fetchCompanies();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to create company', 'error');
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!adminCompanyId) {
      showMessage('Please select a company for this admin', 'error');
      return;
    }
    try {
      const res = await api.post('/superadmin/create-admin', {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        company_id: adminCompanyId,
      });
      showMessage(res.data.message || `Admin "${adminName}" created successfully!`, 'success');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      setAdminCompanyId('');
      fetchAdmins();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to create admin', 'error');
    }
  };

  // Pagination logic
  const indexOfLastCompany = currentCompanyPage * companiesPerPage;
  const indexOfFirstCompany = indexOfLastCompany - companiesPerPage;
  const currentCompanies = companies.slice(indexOfFirstCompany, indexOfLastCompany);

  const indexOfLastAdmin = currentAdminPage * adminsPerPage;
  const indexOfFirstAdmin = indexOfLastAdmin - adminsPerPage;
  const currentAdmins = admins.slice(indexOfFirstAdmin, indexOfLastAdmin);

  const Chevron = ({ open }) => (
    <svg
      className={`chevron ${open ? 'chevron-rotate' : ''}`}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="super-admin-panel">
      <h2 className="super-admin-title" style={{ marginTop: '1.25rem' }}>
        Super Admin Panel
      </h2>

      {/* ── Existing Companies ── */}
      <section className="existing-container">
        <span>Existing Companies</span>
        <div className="table-container">
          <table className="company-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Logo URL</th>
                <th>Tagline</th>
              </tr>
            </thead>
            <tbody>
              {currentCompanies.map((company) => (
                <tr key={company.company_id}>
                  <td>{company.company_id}</td>
                  <td>{company.name}</td>
                  <td><code>{company.slug}</code></td>
                  <td>{company.logo_url || '—'}</td>
                  <td>{company.tagline || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button
              onClick={() => setCurrentCompanyPage((p) => p - 1)}
              disabled={currentCompanyPage === 1}
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentCompanyPage((p) => p + 1)}
              disabled={currentCompanyPage >= Math.ceil(companies.length / companiesPerPage)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* ── Create Company ── */}
      <section className={`create-collapsible ${isCreateCompanyOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="collapsible-trigger"
          onClick={() => setIsCreateCompanyOpen((v) => !v)}
          aria-expanded={isCreateCompanyOpen}
        >
          <span>Create a New Company</span>
          <Chevron open={isCreateCompanyOpen} />
        </button>
        <div className="collapsible-content">
          <div className="create-container">
            <form onSubmit={handleCreateCompany}>
              <div className="grid-layout">
                <div>
                  <label className="label">Name *</label>
                  <input
                    className="input-field"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company Name"
                    required
                  />
                </div>
              </div>
              <div className="grid-layout">
                <div>
                  <label className="label">Logo URL</label>
                  <input
                    className="input-field"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="label">Tagline</label>
                  <input
                    className="input-field"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Company Tagline"
                  />
                </div>
              </div>
              <button type="submit" className="submit-btn">
                Create Company
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Existing Admins ── */}
      <section className="existing-container">
        <span>Existing Admins</span>
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Slug</th>
              </tr>
            </thead>
            <tbody>
              {currentAdmins.map((admin) => (
                <tr key={admin.user_id}>
                  <td>{admin.admin_name}</td>
                  <td>{admin.email}</td>
                  <td>{admin.company_name}</td>
                  <td><code>{admin.company_slug || '—'}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button
              onClick={() => setCurrentAdminPage((p) => p - 1)}
              disabled={currentAdminPage === 1}
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentAdminPage((p) => p + 1)}
              disabled={currentAdminPage >= Math.ceil(admins.length / adminsPerPage)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* ── Create Admin ── */}
      <section className={`create-collapsible ${isCreateAdminOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="collapsible-trigger"
          onClick={() => setIsCreateAdminOpen((v) => !v)}
          aria-expanded={isCreateAdminOpen}
        >
          <span>Create a New Admin</span>
          <Chevron open={isCreateAdminOpen} />
        </button>
        <div className="collapsible-content">
          <div className="create-container">
            <form onSubmit={handleCreateAdmin}>
              <div className="grid-layout">
                <div>
                  <label className="label">Name *</label>
                  <input
                    className="input-field"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    required
                    placeholder="Admin Name"
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    className="input-field"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                    placeholder="admin@company.com"
                  />
                </div>
              </div>
              <div className="grid-layout">
                <div>
                  <label className="label">Password *</label>
                  <input
                    className="input-field"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    placeholder="Temporary Password"
                  />
                </div>
                <div>
                  <label className="label">Company *</label>
                  <select
                    className="input-field"
                    value={adminCompanyId}
                    onChange={(e) => setAdminCompanyId(e.target.value)}
                    required
                  >
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company.company_id} value={company.company_id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="submit-btn">
                Create Admin
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Message ── */}
      {message && (
        <div className={`message ${messageType === 'error' ? 'message-error' : 'message-success'}`}>
          {message}
        </div>
      )}
    </div>
  );
}