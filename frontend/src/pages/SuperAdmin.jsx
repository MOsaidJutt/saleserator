import React, { useState, useEffect } from 'react';
import api from '../api';
import '../components/SuperAdmin.css';

export default function SuperAdmin() {
  const [companies, setCompanies] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [tagline, setTagline] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [assignAdminEmail, setAssignAdminEmail] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [message, setMessage] = useState('');
  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isAssignAdminOpen, setIsAssignAdminOpen] = useState(false);

  // Pagination state
  const [currentCompanyPage, setCurrentCompanyPage] = useState(1);
  const [currentAdminPage, setCurrentAdminPage] = useState(1);
  const companiesPerPage = 5;
  const adminsPerPage = 5;

  const toggleCreateCompany = () => setIsCreateCompanyOpen((v) => !v);
  const toggleCreateAdmin = () => setIsCreateAdminOpen((v) => !v);
  const toggleAssignAdmin = () => setIsAssignAdminOpen((v) => !v);

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

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!companyName.trim() || !subdomain.trim()) {
      setMessage('Company name and subdomain are required');
      return;
    }
    try {
      await api.post('/superadmin/create-company', {
        name: companyName,
        subdomain,
        logo_url: logoUrl,
        tagline,
      });
      setMessage(`Company ${companyName} created successfully!`);
      setCompanyName('');
      setSubdomain('');
      setLogoUrl('');
      setTagline('');
      fetchCompanies(); // Refresh company list
    } catch (err) {
      setMessage(`Error: ${err.message || 'Failed to create company'}`);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      setMessage('Admin name, email, and password are required');
      return;
    }
    try {
      await api.post('/superadmin/create-admin', {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
      });
      setMessage(`Admin ${adminName} created successfully!`);
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      fetchAdmins();
    } catch (err) {
      setMessage(`Error: ${err.message || 'Failed to create admin'}`);
    }
  };

  const handleAssignAdminToCompany = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!companyId || !assignAdminEmail) {
      setMessage('Admin and company are required');
      return;
    }
    try {
      const adminRes = await api.get(`/superadmin/admins/${assignAdminEmail}`);
      const adminId = adminRes.data.user_id;

      await api.post('/superadmin/assign-admin-to-company', {
        adminId,
        companyId,
      });
      setMessage(`Admin assigned to company successfully!`);
    } catch (err) {
      setMessage(
        `Error: ${err.message || 'Failed to assign admin to company'}`,
      );
    }
  };

  // Pagination logic for companies and admins
  const indexOfLastCompany = currentCompanyPage * companiesPerPage;
  const indexOfFirstCompany = indexOfLastCompany - companiesPerPage;
  const currentCompanies = companies.slice(
    indexOfFirstCompany, 
    indexOfLastCompany,
  );

  const indexOfLastAdmin = currentAdminPage * adminsPerPage;
  const indexOfFirstAdmin = indexOfLastAdmin - adminsPerPage;
  const currentAdmins = admins.slice(indexOfFirstAdmin, indexOfLastAdmin);

  const paginateCompanies = (pageNumber) => setCurrentCompanyPage(pageNumber);
  const paginateAdmins = (pageNumber) => setCurrentAdminPage(pageNumber);

  return (
    <div className="super-admin-panel">
      <h2 className="super-admin-title" style={{ marginTop: '1.25rem' }}>
        Super Admin Panel
      </h2>

      {/* Companies Section */}
      <section className="existing-container">
        <span>Existing Companies</span>
        <div className="table-container">
          <table className="company-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Subdomain</th>
                <th>Logo URL</th>
                <th>Tag line</th>
              </tr>
            </thead>
            <tbody>
              {currentCompanies.map((company) => (
                <tr key={company.company_id}>
                  <td>{company.name}</td>
                  <td>{company.subdomain}</td>
                  <td>{company.logoUrl}</td>
                  <td>{company.tagline}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button
              onClick={() => paginateCompanies(currentCompanyPage - 1)}
              disabled={currentCompanyPage === 1}
            >
              Previous
            </button>
            <button
              onClick={() => paginateCompanies(currentCompanyPage + 1)}
              disabled={
                currentCompanyPage === 
                Math.ceil(companies.length / companiesPerPage)
              }
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Create Company Section */}
      <section
        id="createCompany"
        className={`create-collapsible ${isCreateCompanyOpen ? 'is-open' : ''}`}
      >
        <button
          type="button"
          className="collapsible-trigger"
          onClick={toggleCreateCompany}
          aria-expanded={isCreateCompanyOpen}
          aria-controls="createCompanyOpen"
        >
          <span>Create a New Company</span>
          <svg
            className={`chevron ${isCreateCompanyOpen ? 'chevron-rotate' : ''}`}
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
        </button>
        <div id="createCompanyOpen" className="collapsible-content">
          <div className="create-container">
            <form onSubmit={handleCreateCompany}>
              <div className="grid-layout">
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input-field"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company Name"
                    required
                  />
                </div>
                <div>
                  <label className="label">Subdomain</label>
                  <input
                    className="input-field"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    placeholder="Company Subdomain"
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
                    placeholder="Company Logo URL"
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

      {/* Admins Section */}
      <section className="existing-container">
        <span>Existing Admins</span>
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {currentAdmins.map((admin) => (
                <tr key={admin.user_id}>
                  <td>{admin.admin_name}</td>
                  <td>{admin.company_name}</td>
                  <td>{admin.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button
              onClick={() => paginateAdmins(currentAdminPage - 1)}
              disabled={currentAdminPage === 1}
            >
              Previous
            </button>
            <button
              onClick={() => paginateAdmins(currentAdminPage + 1)}
              disabled={
                currentAdminPage === Math.ceil(admins.length / adminsPerPage)
              }
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Create Admin Section */}
      <section
        id="createAdmin"
        className={`create-collapsible ${isCreateAdminOpen ? 'is-open' : ''}`}
      >
        <button
          type="button"
          className="collapsible-trigger"
          onClick={toggleCreateAdmin}
          aria-expanded={isCreateAdminOpen}
          aria-controls="createAdminOpen"
        >
          <span>Create a New Admin</span>
          <svg
            className={`chevron ${isCreateAdminOpen ? 'chevron-rotate' : ''}`}
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
        </button>
        <div id="createAdminOpen" className="collapsible-content">
          <div className="create-container">
            <form onSubmit={handleCreateAdmin}>
              <div className="grid-layout">
                <label className="label">Name</label>
                <input
                  className="input-field"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  placeholder="Admin Name"
                />
              </div>
              <div className="grid-layout">
                <label className="label">Email</label>
                <input
                  className="input-field"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  placeholder="Admin Email"
                />
              </div>
              <div className="grid-layout">
                <label className="label">Password</label>
                <input
                  className="input-field"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  placeholder="Admin Password"
                />
              </div>
              <button type="submit" className="submit-btn">
                Create Admin
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Assign Admin to Company */}
      <section
        id="assignAdmin"
        className={`create-collapsible ${isAssignAdminOpen ? 'is-open' : ''}`}
      >
        <button
          type="button"
          className="collapsible-trigger"
          onClick={toggleAssignAdmin}
          aria-expanded={isAssignAdminOpen}
          aria-controls="AssignAdminOpen"
        >
          <span>Assign Admin To Company</span>
          <svg
            className={`chevron ${isAssignAdminOpen ? 'chevron-rotate' : ''}`}
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
        </button>
        <div id="AssignAdminOpen" className="collapsible-content">
          <div className="create-container">
            <form onSubmit={handleAssignAdminToCompany}>
                <label className="label">Admin Email</label>
                <input
                    className="input-field"
                    type="email"
                    value={assignAdminEmail}
                    onChange={(e) => setAssignAdminEmail(e.target.value)}
                    required
                />
                <label className="label">Select Company</label>
                <select
                    className="input-field"
                    onChange={(e) => setCompanyId(e.target.value)}
                    required
                >
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                    <option key={company.company_id} value={company.company_id}>
                        {company.name}
                    </option>
                    ))}
                </select>
                <button type="submit" className="submit-btn">
                    Assign Admin
                </button>
            </form>
          </div>
        </div>
      </section>

      {/* Display Success/Failure Messages */}
      {message && <div className="message">{message}</div>}
    </div>
  );
}
