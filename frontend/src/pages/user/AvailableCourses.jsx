import React, { useEffect, useState } from 'react';
import api from '../../api';
import Nav from '../../components/Navbar';
import CourseCard from '../../components/CourseCard';
import '../../components/useruistyles/AvailableCourses.css';

const LS_KEY_BASE = 'requestedCourseIds';

// --- Helpers for user-scoped LocalStorage (dev fallback) ---
function getUserScopedKey() {
  try {
    const user = JSON.parse(localStorage.getItem('user')); // assuming user info stored after login
    return `${LS_KEY_BASE}_${user?.id || 'guest'}`;
  } catch {
    return LS_KEY_BASE;
  }
}

function readRequestedFromLS() {
  try {
    const key = getUserScopedKey();
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeRequestedToLS(setOfIds) {
  try {
    const key = getUserScopedKey();
    localStorage.setItem(key, JSON.stringify(Array.from(setOfIds)));
  } catch {
    // eslint-disable-next-line no-empty
  }
}

// -------------------------------------------------------
export default function AvailableCourses() {
  const [browse, setBrowse] = useState([]);
  const [pendingIds, setPendingIds] = useState(new Set());

  // Merge helper (server + local flags)
  const mergeRequestedFlags = (serverCourses, myRequests = []) => {
    const localRequested = readRequestedFromLS();
    const serverRequestMap = new Map(
      myRequests.map((r) => [r.course_id, r.request_status]),
    );

    return (serverCourses || []).map((c) => {
      const statusFromServer = serverRequestMap.get(c.id);
      const requestedFromLocal = localRequested.has(c.id);

      // 🧠 Only treat as requested if status is pending or approved
      const requestedFromServer =
        statusFromServer === 'pending' || statusFromServer === 'approved';

      // 🧹 Ignore disapproved — remove it from local cache if found
      if (statusFromServer === 'disapproved' && localRequested.has(c.id)) {
        localRequested.delete(c.id);
        writeRequestedToLS(localRequested);
      }

      return {
        ...c,
        requested: requestedFromServer || requestedFromLocal,
        request_status:
          statusFromServer || (requestedFromLocal ? 'pending' : null),
      };
    });
  };

  const load = async () => {
    try {
      // Fetch both catalog and request statuses
      const [catalogRes, mineRes] = await Promise.all([
        api.get('/users/courses/catalog'),
        api.get('/users/courses/requests/mine'),
      ]);

      const merged = mergeRequestedFlags(
        catalogRes.data || [],
        mineRes.data || [],
      );

      setBrowse(merged);
    } catch (err) {
      console.error('Failed to load catalog or requests:', err);
      // fallback to local-only logic
      try {
        const catalog = await api.get('/users/courses/catalog');
        const merged = mergeRequestedFlags(catalog.data || []);
        setBrowse(merged);
      } catch {
        setBrowse([]);
      }
    }
  };

  useEffect(() => {
    load();
  }, []);

  const requestCourse = async (course) => {
    if (pendingIds.has(course.id) || course.requested) return;

    setPendingIds((prev) => new Set(prev).add(course.id));

    try {
      await api.post('/users/courses/request', { course_id: course.id });

      setBrowse((prev) =>
        prev.map((item) =>
          item.id === course.id
            ? { ...item, requested: true, request_status: 'pending' }
            : item,
        ),
      );

      const next = readRequestedFromLS();
      next.add(course.id);
      writeRequestedToLS(next);
    } catch (err) {
      console.error('Request failed:', err);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(course.id);
        return next;
      });
    }
  };

  return (
    <div>
      <Nav />
      <div className="available-courses-page">
        <section className="available-courses-box">
          <div className="available-courses-head">
            <h2>Available Courses</h2>
          </div>

          <div className="available-courses-body">
            {browse.length === 0 ? (
              <p className="no-courses-text">No courses available right now.</p>
            ) : (
              <div className="available-courses-grid">
                {browse.map((c) => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    actionText={
                      c.request_status === 'approved'
                        ? 'Approved'
                        : c.request_status === 'pending'
                          ? 'Pending approval'
                          : 'Request access'
                    }
                    variant="requests"
                    onAction={() => requestCourse(c)}
                    disabled={
                      c.request_status === 'approved' ||
                      c.request_status === 'pending' ||
                      pendingIds.has(c.id)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
