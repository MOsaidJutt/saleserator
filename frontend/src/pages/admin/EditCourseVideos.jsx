import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api';
import axios from 'axios';
import Nav from '../../components/Navbar';
import '../../components/adminuistyles/EditCourseVideos.css';

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

      const cleanup = () => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /*ignore*/
        }
      };

      video.onloadedmetadata = () => {
        const d = Math.round(video.duration || 0);
        cleanup();
        resolve(d);
      };
      video.onerror = (e) => {
        cleanup();
        reject(e || new Error('Failed to read video metadata'));
      };

      video.src = url;
    } catch (e) {
      reject(e);
    }
  });
}

export default function EditCourseVideos() {
  const { id } = useParams(); // /admin/courses/:id/edit
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);

  // files: [{ tempId, file, name, type, size, durationSeconds, durationState }]
  const [files, setFiles] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        const res = await api.get(`/admin/courses/${id}`);
        setCourse(res.data.course);
        setVideos(res.data.videos || []);
        setTitle(res.data.course.title);
        setCategory(res.data.course.category);
        setDescription(res.data.course.description || '');
        setPoints(res.data.course.points ?? '');
      } catch (e) {
        console.error(e);
        alert('Failed to load course');
      } finally {
        setLoading(false);
      }
    };
    fetchCourseData();
  }, [id]);

  const s3Folder = useMemo(() => {
    if (!course) return '';
    return course.s3_prefix || `courses/${course?.id}/`;
  }, [course]);

  async function onPickFiles(e) {
    const list = Array.from(e.target.files || []);
    if (list.length === 0) return;

    // seed UI entries
    const mapped = list.map((f, idx) => ({
      tempId: `${Date.now()}_${Math.random().toString(36).slice(2)}_${idx}`,
      file: f,
      name: f.name,
      type: f.type || 'application/octet-stream',
      size: f.size,
      durationSeconds: null,
      durationState: 'measuring', // measuring | ready | error
    }));

    setFiles((prev) => [...prev, ...mapped]);
    setProgressMap((prev) => {
      const next = { ...prev };
      mapped.forEach((m) => (next[m.tempId] = 0));
      return next;
    });

    // measure durations asynchronously
    for (const m of mapped) {
      try {
        const d = await getVideoDurationFromFile(m.file);
        setFiles((prev) =>
          prev.map((x) =>
            x.tempId === m.tempId
              ? {
                  ...x,
                  durationSeconds: Math.max(0, Math.floor(d || 0)),
                  durationState: 'ready',
                }
              : x,
          ),
        );
      } catch (err) {
        console.warn('Duration measure failed for', m.name, err);
        setFiles((prev) =>
          prev.map((x) =>
            x.tempId === m.tempId
              ? { ...x, durationSeconds: null, durationState: 'error' }
              : x,
          ),
        );
      }
    }
  }

  const removeFile = (tempId) => {
    setFiles((prev) => prev.filter((f) => f.tempId !== tempId));
    setProgressMap((prev) => {
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
  };

  const clearFiles = () => {
    setFiles([]);
    setProgressMap({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    try {
      // Ensure every file has a duration if possible
      for (const f of files) {
        if (!(Number.isFinite(f.durationSeconds) && f.durationSeconds > 0)) {
          try {
            const d = await getVideoDurationFromFile(f.file);
            f.durationSeconds = Math.max(0, Math.floor(d || 0));
            f.durationState = f.durationSeconds > 0 ? 'ready' : 'error';
            setFiles((prev) =>
              prev.map((x) => (x.tempId === f.tempId ? { ...f } : x)),
            );
          } catch {
            // keep null; backend can self-heal later
            f.durationState = 'error';
          }
        }
      }

      // 1) presign
      const payload = {
        files: files.map((f) => ({ fileName: f.name, contentType: f.type })),
      };
      const presign = await api.post(`/admin/courses/${id}/presign`, payload);
      const items = presign.data.items || [];
      const byName = new Map(items.map((x) => [x.fileName, x]));

      // 2) upload to S3
      const completed = [];
      for (const f of files) {
        const meta = byName.get(f.name);
        if (!meta) {
          console.warn('Missing presigned meta for', f.name);
          continue;
        }
        setProgressMap((pm) => ({ ...pm, [f.tempId]: 0 }));

        await axios.put(meta.uploadUrl, f.file, {
          headers: { 'Content-Type': f.type || 'application/octet-stream' },
          onUploadProgress: (evt) => {
            if (!evt.total) return;
            const pct = Math.round((evt.loaded / evt.total) * 100);
            setProgressMap((pm) => ({ ...pm, [f.tempId]: pct }));
          },
          maxBodyLength: Infinity,
        });

        setProgressMap((pm) => ({ ...pm, [f.tempId]: 100 }));

        completed.push({
          key: meta.key,
          fileName: f.name,
          contentType: f.type,
          byteSize: f.size,
          // ✅ send measured duration seconds to backend
          durationSeconds: Number.isFinite(f.durationSeconds)
            ? f.durationSeconds
            : null,
        });
      }

      // 3) persist metadata (backend should write duration_seconds to course_assets)
      //    NOTE: keeping your endpoint shape `/admin/courses/${id}/`
      const save = await api.post(`/admin/courses/${id}/`, {
        items: completed,
      });

      // If your API returns created/updated video rows, reflect them in UI
      if (save?.data?.videos)
        setVideos((prev) => [...prev, ...save.data.videos]);
      clearFiles();
      alert('Upload complete!');
    } catch (e) {
      console.error(e);
      alert('Upload failed. See console for details.');
    } finally {
      setUploading(false);
    }
  }

  const handleCourseUpdate = async (e) => {
    e.preventDefault();
    try {
      const updatedCourse = {
        title,
        category,
        description,
        points: points === '' ? null : Number(points),
      };
      await api.patch(`/admin/courses/${id}`, updatedCourse);
      alert('Course updated successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to update course');
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('Are you sure you want to delete this video?')) return;
    try {
      await api.delete(`/admin/courses/${id}/assets/${videoId}`);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      alert('Video deleted successfully');
    } catch (error) {
      console.error('Error deleting video:', error);
      alert(
        'An error occurred while deleting the video. Check the console for details.',
      );
    }
  };

  // Open via signed URL (kept from your code)
  const openVideo = async (assetId) => {
    const tab = window.open('about:blank', '_blank');
    try {
      const { data } = await api.get(
        `/admin/courses/${id}/assets/${assetId}/url`,
      );
      const url = data?.url;
      if (!url) throw new Error('No signed URL returned');
      try {
        if (tab) tab.opener = null;
      } catch {
        /*ignore*/
      }
      if (tab) tab.location.assign(url);
      else window.open(url, '_blank');
    } catch (err) {
      console.error(err);
      try {
        if (tab) tab.close();
      } catch {
        /*ignore*/
      }
      alert('Failed to open the video.');
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!course) return <div className="p-6 text-red-500">Course not found</div>;

  return (
    <div>
      <Nav />

      <div className="edit-course-container">
        {/* Header */}
        <div className="edit-course-header">
          <h1>Edit Course: {course.title}</h1>
          <Link to="/admin/CourseUpload" className="back-link">
            Back to Courses
          </Link>
        </div>

        {/* Body */}
        <div className="edit-body">
          {/* Edit Course Details */}
          <div className="edit-card">
            <h2 className="section-title">Course Details</h2>
            <hr className="divider" />

            <form onSubmit={handleCourseUpdate} className="edit-form">
              <div className="form-field">
                <label>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="form-input"
                  placeholder="Course title"
                />
              </div>

              <div className="form-field">
                <label>Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="form-input"
                  placeholder="Category"
                />
              </div>

              <div className="form-field field--full">
                <label>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-textarea"
                  placeholder="Describe the course (optional)"
                />
              </div>

              <div className="form-field form-field--compact">
                <label>Points</label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="actions field--full">
                <button type="submit" className="save-btn">
                  Save Course Details
                </button>
              </div>
            </form>
          </div>

          {/* Course Folder */}
          <div className="edit-card">
            <h2 className="section-title">Course Folder</h2>
            <hr className="divider" />

            <div className="course-folder">
              <div className="text">
                <span className="folder-path">s3://</span>
                {s3Folder}
              </div>
            </div>
          </div>

          {/* Add Videos */}
          <div className="edit-card">
            <h2 className="section-title">Add More Videos</h2>
            <hr className="divider" />

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              onChange={onPickFiles}
              className="file-input form-input"
            />

            {files.length > 0 && (
              <div className="file-upload-progress">
                {files.map((f) => {
                  const p = progressMap[f.tempId] || 0;
                  const colorClass =
                    p < 30
                      ? 'progress-red'
                      : p < 70
                        ? 'progress-yellow'
                        : 'progress-green';

                  return (
                    <div key={f.tempId} className="file-item">
                      <div className="file-header">
                        <span className="file-name">
                          {f.name} ({Math.round(f.size / 1024 / 1024)} MB)
                          {' · '}
                          {f.durationState === 'ready' && f.durationSeconds > 0
                            ? fmt(f.durationSeconds)
                            : f.durationState === 'measuring'
                              ? 'measuring…'
                              : 'duration unavailable'}
                        </span>
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={() => removeFile(f.tempId)}
                          aria-label="Remove file"
                          title="Remove file"
                          style={{ margin: '20px' }}
                        >
                          ❌
                        </button>
                      </div>

                      <div className="progress-bar-container">
                        <div
                          className={`progress-bar ${colorClass}`}
                          style={{ width: `${p}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                disabled={uploading || files.length === 0}
                onClick={handleUpload}
                className="upload-btn"
              >
                {uploading ? 'Uploading…' : 'Upload & Save'}
              </button>

              <button type="button" onClick={clearFiles} className="btn-ghost">
                Clear
              </button>
            </div>
          </div>

          {/* Existing Videos */}
          <div className="edit-card">
            <h2 className="section-title">Existing Videos</h2>
            <hr className="divider" />

            {videos.length === 0 ? (
              <div className="no-videos-text muted">No videos yet.</div>
            ) : (
              <ul className="existing-videos-list">
                {videos.map((v) => (
                  <li key={v.id} className="video-item">
                    <div className="file-header">
                      <div className="file-name">{v.file_name}</div>
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => handleDeleteVideo(v.id)}
                        aria-label="Delete video"
                        title="Delete video"
                      >
                        ❌
                      </button>
                    </div>

                    <div className="s3-key">{v.s3_key}</div>

                    <button
                      type="button"
                      className="file-link"
                      onClick={() => openVideo(v.id)}
                    >
                      Open
                    </button>
                    {v.size_bytes != null && (
                      <div className="file-size">
                        Size: {Intl.NumberFormat().format(v.size_bytes)} bytes
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
