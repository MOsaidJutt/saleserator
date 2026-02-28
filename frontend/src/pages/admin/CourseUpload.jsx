import React, { useEffect, useState, useRef } from 'react';
import api from '../../api';
import s3PlainAxios from '../../s3PlainAxios';
import { Link } from 'react-router-dom';
import Nav from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import '../../components/adminuistyles/CourseForm.css';

/** Helper: format seconds as h/m/s, e.g. 1h 12m / 3m 40s / 42s */
function fmt(sec = 0) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m${s ? ' ' + s + 's' : ''}`;
  return `${s}s`;
}

/** Measure duration from a local File using an off-DOM <video> element */
function getVideoDurationFromFile(file) {
  return new Promise((resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const url = URL.createObjectURL(file);

      const cleanup = () => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          ('empty');
        }
      };

      const onLoaded = () => {
        const d = Math.round(video.duration || 0);
        cleanup();
        resolve(d);
      };
      const onError = (err) => {
        cleanup();
        reject(err || new Error('Failed to read video metadata'));
      };

      video.onloadedmetadata = onLoaded;
      video.onerror = onError;
      video.src = url;
    } catch (e) {
      reject(e);
    }
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

  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(null);
  const [durationState, setDurationState] = useState('idle');

  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const toggleCreate = () => setIsCreateOpen((v) => !v);

  const fileInputRef = useRef(null);
  const [rowBusy, setRowBusy] = useState(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await api.get('/admin/courses');
      // backend already returns hidden boolean
      setCourses(res.data || []);
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  };

  // Ensure we always have duration before submit when a file is chosen
  async function ensureDurationMeasured(selFile) {
    if (!selFile) return null;
    if (Number.isFinite(duration) && duration > 0) return duration;

    setDurationState('measuring');
    try {
      const d = await getVideoDurationFromFile(selFile);
      const safe = Math.max(0, Math.floor(d || 0));
      setDuration(safe);
      setDurationState('ready');
      return safe;
    } catch (e) {
      console.warn('Video duration measurement failed:', e);
      setDurationState('error');
      return null;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return alert('Title is required');

    try {
      setCreating(true);

      if (editingCourse) {
        await api.patch(`/admin/courses/${editingCourse.id}`, {
          title,
          category,
          points: Number(points) || 0,
          description,
        });
      } else {
        const createRes = await api.post('/admin/courses', {
          title,
          category,
          points: Number(points) || 0,
          hidden: false, // new courses visible by default
          storage_provider: 's3',
          media_type: 'video',
          description,
        });

        const courseId = createRes.data.id;

        if (file) {
          let durationSec = await ensureDurationMeasured(file);
          const contentType = file.type || 'video/mp4';
          const fileExt = (file.name.split('.').pop() || 'mp4').toLowerCase();

          const presignRes = await api.post('/admin/uploads/presign', {
            course_id: courseId,
            contentType,
            fileExt,
          });

          const { uploadUrl, s3Key } = presignRes.data;

          setUploading(true);
          setProgress(0);
          await s3PlainAxios.put(uploadUrl, file, {
            headers: { 'Content-Type': contentType },
            onUploadProgress: (evt) => {
              if (!evt.total) return;
              setProgress(Math.round((evt.loaded / evt.total) * 100));
            },
          });

          await api.post(`/admin/courses/${courseId}/assets`, {
            s3_key: s3Key,
            kind: 'video',
            mime_type: contentType,
            size_bytes: file.size,
            duration_seconds: Number.isFinite(durationSec) ? durationSec : null,
            is_default: true,
            file_name: file.name,
          });
        }
      }

      setUploading(false);
      setProgress(100);
      setCreating(false);
      alert('Course saved successfully!');

      setTitle('');
      setCategory('');
      setDescription('');
      setPoints(0);
      setFile(null);
      setDuration(null);
      setDurationState('idle');
      setEditingCourse(null);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsCreateOpen(false);

      fetchCourses();
    } catch (err) {
      setCreating(false);
      setUploading(false);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Upload failed';
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

  // Hide/Unhide toggle using actual hidden column
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
      alert(
        `Failed to ${course.hidden ? 'unhide' : 'hide'} course: ${
          err.message || 'Unknown error'
        }`,
      );
    } finally {
      setRowBusy(null);
    }
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setProgress(0);
      setDuration(null);
      setDurationState('measuring');
      try {
        const d = await getVideoDurationFromFile(selectedFile);
        setDuration(Math.round(d || 0));
        setDurationState('ready');
      } catch (err) {
        console.warn('Failed to read duration:', err);
        setDuration(null);
        setDurationState('error');
      }
    } else {
      setFile(null);
      setDuration(null);
      setDurationState('idle');
      setProgress(0);
    }
  };

  return (
    <div>
      <Nav />
      <h2 className="course-form-title" style={{ marginTop: '1.25rem' }}>
        Courses
      </h2>

      {/* Collapsible: Create New Course */}
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
          <svg
            className="chevron"
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
                  <label className="label">Video file</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="input-field"
                    onChange={handleFileChange}
                  />

                  {file && (
                    <div className="file-name">
                      {file.name} ({Math.round(file.size / 1024 / 1024)} MB)
                      {durationState === 'ready' && duration > 0 && (
                        <> · {fmt(duration)}</>
                      )}
                      {durationState === 'measuring' && <> · measuring…</>}
                      {durationState === 'error' && (
                        <> · duration unavailable</>
                      )}
                    </div>
                  )}

                  {file && (
                    <div className="file-upload-progress">
                      <div className="file-item">
                        <div className="progress-bar-container">
                          <div
                            className={`progress-bar ${
                              progress < 30
                                ? 'progress-red'
                                : progress < 70
                                  ? 'progress-yellow'
                                  : 'progress-green'
                            }`}
                            style={{ width: `${progress}%` || 0 }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={creating || uploading}
                className="submit-btn"
              >
                {creating
                  ? 'Saving...'
                  : uploading
                    ? `Uploading ${progress}%`
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
                        <span className="hidden-pill" title="Hidden from users">
                          Hidden
                        </span>
                      )}
                      {course.title}
                    </div>
                    <div className="course-card-sub">
                      {course.category || 'Uncategorized'} ·{' '}
                      {course.points ?? 0} pts
                    </div>
                  </div>
                  <div className="course-card-actions">
                    <Link
                      to={`/${slug}/admin/courses/${course.id}/edit`}
                      className="course-item-btn"
                    >
                      Edit
                    </Link>

                    {/* Hide / Unhide */}
                    <button
                      onClick={() => handleToggleVisibility(course)}
                      className="course-item-btn"
                      type="button"
                      disabled={rowBusy === course.id}
                      title={course.hidden ? 'Unhide course' : 'Hide course'}
                    >
                      {rowBusy === course.id
                        ? 'Working...'
                        : course.hidden
                          ? 'Unhide'
                          : 'Hide'}
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