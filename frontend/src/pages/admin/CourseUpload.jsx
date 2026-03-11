import React, { useEffect, useState, useRef } from 'react';
import api from '../../api';
import s3PlainAxios from '../../s3PlainAxios';
import { Link } from 'react-router-dom';
import Nav from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import '../../components/adminuistyles/CourseForm.css';

function fmt(sec = 0) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m${s ? ' ' + s + 's' : ''}`;
  return `${s}s`;
}

function getVideoDurationFromFile(file) {
  return new Promise((resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const url = URL.createObjectURL(file);
      const cleanup = () => { try { URL.revokeObjectURL(url); } catch { (''); } };
      video.onloadedmetadata = () => { const d = Math.round(video.duration || 0); cleanup(); resolve(d); };
      video.onerror = (err) => { cleanup(); reject(err || new Error('Failed to read video metadata')); };
      video.src = url;
    } catch (e) { reject(e); }
  });
}

export default function AdminCourseUpload() {
  const { user } = useAuth();
  const slug = user?.company_slug;
  const [courses, setCourses] = useState([]);
  const [editingCourse, setEditingCourse] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(0);

  // Multiple files — each entry: { file, duration, durationState, progress, status }
  const [fileItems, setFileItems] = useState([]);

  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const toggleCreate = () => setIsCreateOpen((v) => !v);

  const fileInputRef = useRef(null);
  const [rowBusy, setRowBusy] = useState(null);

  useEffect(() => { fetchCourses(); }, []);

  const fetchCourses = async () => {
    try {
      const res = await api.get('/admin/courses');
      setCourses(res.data || []);
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  };

  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    // Build initial items with measuring state
    const initial = selected.map((file) => ({
      file,
      duration: null,
      durationState: 'measuring',
      progress: 0,
      status: 'pending', // pending | uploading | done | error
    }));
    setFileItems((prev) => [...prev, ...initial]);

    // Measure durations in parallel
    selected.forEach(async (file, i) => {
      const idx = fileItems.length + i; // index in the new array
      try {
        const d = await getVideoDurationFromFile(file);
        setFileItems((prev) =>
          prev.map((item, j) =>
            j === idx
              ? { ...item, duration: Math.round(d || 0), durationState: 'ready' }
              : item
          )
        );
      } catch {
        setFileItems((prev) =>
          prev.map((item, j) =>
            j === idx ? { ...item, durationState: 'error' } : item
          )
        );
      }
    });

    // Reset input so same files can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx) => {
    setFileItems((prev) => prev.filter((_, i) => i !== idx));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return alert('Title is required');

    try {
      setCreating(true);

      if (editingCourse) {
        await api.patch(`/admin/courses/${editingCourse.id}`, {
          title, category, points: Number(points) || 0, description,
        });
      } else {
        const createRes = await api.post('/admin/courses', {
          title, category, points: Number(points) || 0,
          hidden: false, storage_provider: 's3', media_type: 'video', description,
        });

        const courseId = createRes.data.id;
        setCreating(false);

        if (fileItems.length > 0) {
          setUploading(true);

          for (let idx = 0; idx < fileItems.length; idx++) {
            const item = fileItems[idx];
            const { file } = item;

            // Mark as uploading
            setFileItems((prev) =>
              prev.map((it, i) => i === idx ? { ...it, status: 'uploading' } : it)
            );

            try {
              const contentType = file.type || 'video/mp4';
              const fileExt = (file.name.split('.').pop() || 'mp4').toLowerCase();

              const presignRes = await api.post('/admin/uploads/presign', {
                course_id: courseId, contentType, fileExt,
              });
              const { uploadUrl, s3Key } = presignRes.data;

              await s3PlainAxios.put(uploadUrl, file, {
                headers: { 'Content-Type': contentType },
                onUploadProgress: (evt) => {
                  if (!evt.total) return;
                  const pct = Math.round((evt.loaded / evt.total) * 100);
                  setFileItems((prev) =>
                    prev.map((it, i) => i === idx ? { ...it, progress: pct } : it)
                  );
                },
              });

              await api.post(`/admin/courses/${courseId}/assets`, {
                s3_key: s3Key,
                kind: 'video',
                mime_type: contentType,
                size_bytes: file.size,
                duration_seconds: Number.isFinite(item.duration) ? item.duration : null,
                is_default: idx === 0, // first video is default
                file_name: file.name,
              });

              setFileItems((prev) =>
                prev.map((it, i) => i === idx ? { ...it, status: 'done', progress: 100 } : it)
              );
            } catch (err) {
              setFileItems((prev) =>
                prev.map((it, i) => i === idx ? { ...it, status: 'error' } : it)
              );
              console.error(`Failed to upload ${file.name}:`, err);
            }
          }

          setUploading(false);
        }
      }

      setCreating(false);
      alert('Course saved successfully!');

      setTitle('');
      setCategory('');
      setDescription('');
      setPoints(0);
      setFileItems([]);
      setEditingCourse(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsCreateOpen(false);

      fetchCourses();
    } catch (err) {
      setCreating(false);
      setUploading(false);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Upload failed';
      console.error('Error:', err);
      alert(msg);
    }
  }

  const handleDelete = async (courseId) => {
    try {
      setRowBusy(courseId);
      await api.delete(`/admin/courses/${courseId}`);
      await fetchCourses();
    } catch (err) {
      console.error('Error deleting course:', err);
      alert(`Failed to delete course: ${err.message || 'Unknown error'}`);
    } finally {
      setRowBusy(null);
    }
  };

  const handleToggleVisibility = async (course) => {
    try {
      setRowBusy(course.id);
      if (course.hidden) {
        await api.patch(`/admin/courses/${course.id}/unhide`);
      } else {
        await api.patch(`/admin/courses/${course.id}/hide`);
      }
      await fetchCourses();
    } catch (err) {
      console.error('Error toggling visibility:', err);
      alert(`Failed to ${course.hidden ? 'unhide' : 'hide'} course: ${err.message || 'Unknown error'}`);
    } finally {
      setRowBusy(null);
    }
  };

  const allDone = fileItems.length > 0 && fileItems.every((f) => f.status === 'done');
  const anyUploading = fileItems.some((f) => f.status === 'uploading');

  return (
    <div>
      <Nav />
      <h2 className="course-form-title" style={{ marginTop: '1.25rem' }}>
        Courses
      </h2>

      <section
        id="createCourse"
        className={`course-form-collapsible ${isCreateOpen ? 'is-open' : ''}`}
      >
        <button
          type="button"
          className="collapsible-trigger"
          onClick={toggleCreate}
          aria-expanded={isCreateOpen}
          aria-controls="createCourseContent"
        >
          <span>Create a New Course</span>
          <svg className="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div id="createCourseContent" className="collapsible-content">
          <div className="course-form-container">
            <form onSubmit={handleSubmit} className="course-form">
              <div className="grid-layout">
                <div>
                  <label className="label">Title</label>
                  <input
                    className="input-field"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Course Title"
                    required
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <input
                    className="input-field"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Category"
                  />
                </div>
              </div>

              <div>
                <label className="label">Description (optional)</label>
                <textarea
                  className="textarea-field"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Course Description"
                />
              </div>

              <div className="grid-layout">
                <div>
                  <label className="label">Points</label>
                  <input
                    type="number"
                    className="input-field"
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">
                    Video files
                    <span style={{ opacity: 0.5, fontWeight: 400, marginLeft: '0.4rem', fontSize: '0.8rem' }}>
                      (select multiple)
                    </span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    multiple
                    className="input-field"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </div>
              </div>

              {/* File list with individual progress bars */}
              {fileItems.length > 0 && (
                <div className="file-upload-progress" style={{ marginTop: '0.75rem' }}>
                  {fileItems.map((item, idx) => (
                    <div key={idx} className="file-item" style={{ marginBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.85rem', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                          {item.file.name}
                          {' '}
                          <span style={{ opacity: 0.5 }}>
                            ({Math.round(item.file.size / 1024 / 1024)} MB
                            {item.durationState === 'ready' && item.duration > 0 && ` · ${fmt(item.duration)}`}
                            {item.durationState === 'measuring' && ' · measuring…'}
                            )
                          </span>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {item.status === 'done' && <span style={{ color: '#22c55e', fontSize: '0.8rem' }}>✓ Done</span>}
                          {item.status === 'error' && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>✗ Failed</span>}
                          {item.status === 'uploading' && <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>{item.progress}%</span>}
                          {item.status === 'pending' && !uploading && (
                            <button
                              type="button"
                              onClick={() => removeFile(idx)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.25rem' }}
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="progress-bar-container">
                        <div
                          className={`progress-bar ${
                            item.status === 'error' ? 'progress-red' :
                            item.status === 'done' ? 'progress-green' :
                            item.progress < 30 ? 'progress-red' :
                            item.progress < 70 ? 'progress-yellow' :
                            'progress-green'
                          }`}
                          style={{ width: `${item.status === 'done' ? 100 : item.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={creating || uploading}
                className="submit-btn"
              >
                {creating
                  ? 'Creating course...'
                  : uploading
                    ? `Uploading videos...`
                    : editingCourse
                      ? 'Update Course'
                      : 'Create & Upload'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Existing Courses */}
      <section className="existing-courses-wrap">
        <h3 className="existing-courses-title">Existing Courses</h3>
        <div className="existing-courses-body">
          <div className="course-list">
            {courses.map((course) => (
              <article key={course.id} className="course-card">
                <div className="course-card-header">
                  <div>
                    <div className="course-card-title">
                      {course.hidden && (
                        <span className="hidden-pill" title="Hidden from users">Hidden</span>
                      )}
                      {course.title}
                    </div>
                    <div className="course-card-sub">
                      {course.category || 'Uncategorized'} · {course.points ?? 0} pts
                    </div>
                  </div>
                  <div className="course-card-actions">
                    <Link to={`/${slug}/admin/courses/${course.id}/edit`} className="course-item-btn">
                      Edit
                    </Link>
                    <button
                      onClick={() => handleToggleVisibility(course)}
                      className="course-item-btn"
                      type="button"
                      disabled={rowBusy === course.id}
                    >
                      {rowBusy === course.id ? 'Working...' : course.hidden ? 'Unhide' : 'Hide'}
                    </button>
                    <button
                      onClick={() => handleDelete(course.id)}
                      className="delete-btn"
                      type="button"
                      disabled={rowBusy === course.id}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}