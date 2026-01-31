import React, { useEffect, useState } from 'react';
import api from '../../api';
import { CheckCircle, XCircle } from 'lucide-react';
import Nav from '../../components/Navbar';
import '../../components/adminuistyles/CourseRequests.css';

export default function CourseRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/requests');
      setRequests(res.data || []);
    } catch (error) {
      console.error('Failed to fetch requests', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (r) => {
    try {
      await api.post('/admin/requests/approve', { request_id: r.id });
      load();
    } catch (error) {
      console.error('Failed to approve request', error);
    }
  };

  const disapprove = async (r) => {
    try {
      await api.post('/admin/requests/disapprove', { request_id: r.id });
      load();
    } catch (error) {
      console.error('Failed to disapprove request', error);
    }
  };

  return (
    <div className="Navbar">
      <Nav />
      <div className="cr-wrap">
        <section className="cr-panel">
          <div className="cr-head">Pending Course Requests</div>

          {loading && <div className="cr-status">Loading…</div>}

          {!loading && requests.length === 0 && (
            <div className="cr-empty">No requests right now.</div>
          )}

          <div className="cr-list">
            {requests.map((r) => (
              <div key={r.id} className="cr-card">
                <div className="cr-meta">
                  <div>
                    <span className="cr-label">User:</span> {r.user_name}
                  </div>
                  <div>
                    <span className="cr-label">Course:</span> {r.course_title}
                  </div>
                </div>

                <div className="cr-actions">
                  <button className="cr-approve" onClick={() => approve(r)}>
                    <CheckCircle size={16} /> Approve
                  </button>
                  <button className="cr-reject" onClick={() => disapprove(r)}>
                    <XCircle size={16} /> Disapprove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
