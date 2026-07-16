import { useRef, useState } from 'react';
import {
  useMatchVideos,
  useUploadVideo,
  useDeleteVideo,
  useVideoTimestamps,
  useCreateTimestamp,
  useDeleteTimestamp,
} from '../../hooks';
import { videosApi } from '../../lib/api';
import type { Video } from '../../types';

// ─── Timestamp list for the selected video ─────────────────────────────────────

function TimestampList({ video, videoRef }: { video: Video; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const { data: timestamps, isLoading } = useVideoTimestamps(video.id);
  const createTs = useCreateTimestamp(video.id);
  const deleteTs = useDeleteTimestamp(video.id);
  const [label, setLabel] = useState('');

  function handleCapture() {
    const t = videoRef.current?.currentTime ?? 0;
    if (!label.trim()) return;
    createTs.mutate({ timestampSeconds: Math.floor(t), label: label.trim() });
    setLabel('');
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div className="space-y-3">
      {/* Capture control */}
      <div className="flex gap-2 items-center">
        <input
          className="input text-sm flex-1"
          placeholder="Label (e.g. Kill, Block, Momentum shift)…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
        />
        <button
          className="btn-secondary text-sm px-3 shrink-0"
          disabled={!label.trim() || createTs.isPending}
          onClick={handleCapture}
        >
          + Tag current time
        </button>
      </div>

      {/* Timestamp list */}
      {isLoading ? (
        <p className="text-xs text-chalk-500">Loading timestamps…</p>
      ) : !timestamps?.length ? (
        <p className="text-xs text-chalk-500 italic">No timestamps yet. Play the video, then tag moments above.</p>
      ) : (
        <div className="space-y-1">
          {timestamps.map((ts) => (
            <div
              key={ts.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 bg-court-800 hover:bg-court-700 cursor-pointer group"
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime = ts.timestampSeconds;
              }}
            >
              <span className="font-mono text-xs text-navy-700 shrink-0 w-10">
                {formatTime(ts.timestampSeconds)}
              </span>
              <span className="text-sm text-chalk-200 flex-1">{ts.label}</span>
              <button
                className="text-chalk-600 hover:text-error text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTs.mutate(ts.id);
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  matchId: string;
}

export default function VideoPanel({ matchId }: Props) {
  const { data: videos, isLoading } = useMatchVideos(matchId);
  const uploadVideo = useUploadVideo(matchId);
  const deleteVideo = useDeleteVideo(matchId);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [uploadError, setUploadError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    try {
      await uploadVideo.mutateAsync(file);
    } catch (err: any) {
      setUploadError(err?.response?.data?.error ?? "Couldn't upload that video. Check your connection and try again.");
    }
    e.target.value = '';
  }

  return (
    <div className="space-y-4">
      {/* Upload control */}
      <div className="flex items-center gap-3">
        <label className="btn-secondary text-sm cursor-pointer">
          {uploadVideo.isPending ? 'Uploading…' : '+ Upload video'}
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploadVideo.isPending}
          />
        </label>
        <span className="text-xs text-chalk-500">MP4, MOV, WebM · max 500 MB</span>
        {uploadError && <span className="text-xs text-error">{uploadError}</span>}
      </div>

      {/* Video list */}
      {isLoading ? (
        <p className="text-sm text-chalk-400">Loading videos…</p>
      ) : !videos?.length ? (
        <div className="card p-6 text-center text-chalk-500 text-sm">
          No videos yet — upload match footage to tag key moments.
        </div>
      ) : (
        <div className="space-y-1">
          {videos.map((v) => (
            <div
              key={v.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                selectedVideo?.id === v.id
                  ? 'bg-court-700 border border-court-600'
                  : 'bg-court-800 hover:bg-court-700'
              }`}
              onClick={() => setSelectedVideo(selectedVideo?.id === v.id ? null : v)}
            >
              <span className="text-sm text-chalk-100 flex-1 truncate">{v.filename}</span>
              <span className="text-xs text-chalk-500 shrink-0">
                {new Date(v.uploadedAt).toLocaleDateString()}
              </span>
              <button
                className="text-chalk-600 hover:text-error text-xs shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${v.filename}"? This cannot be undone.`)) {
                    if (selectedVideo?.id === v.id) setSelectedVideo(null);
                    deleteVideo.mutate(v.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Selected video player + timestamps */}
      {selectedVideo && (
        <div className="card p-4 space-y-4">
          <h3 className="text-sm font-semibold text-chalk-100 truncate">{selectedVideo.filename}</h3>
          <video
            ref={videoRef}
            controls
            className="w-full rounded-lg bg-black"
            src={videosApi.fileUrl(selectedVideo.id)}
          />
          <TimestampList video={selectedVideo} videoRef={videoRef} />
        </div>
      )}
    </div>
  );
}
