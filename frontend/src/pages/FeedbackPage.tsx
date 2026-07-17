import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAllFeedback, useCreateFeedback, useMyFeedback, useUpdateFeedbackStatus } from '../hooks';
import { feedbackApi } from '../lib/api';
import type { Feedback, FeedbackSeverity, FeedbackStatus, FeedbackType } from '../types/feedback';
import { CHAT_ACCEPT_ATTR, formatBytes, rejectFileReason } from '../components/chat/format';

// Bug screenshots, not chat threads — tighter cap than chat's 10.
const MAX_FEEDBACK_ATTACHMENTS = 5;

const TYPE_LABELS: Record<FeedbackType, string> = {
  BUG: 'Bug report',
  FEATURE_REQUEST: 'Feature request',
  GENERAL: 'General',
};

const TYPE_BADGE: Record<FeedbackType, string> = {
  BUG: 'badge-error',
  FEATURE_REQUEST: 'badge-info',
  GENERAL: 'badge-neutral',
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  WONT_FIX: "Won't fix",
};

const STATUS_BADGE: Record<FeedbackStatus, string> = {
  OPEN: 'badge-neutral',
  IN_PROGRESS: 'badge-accent',
  RESOLVED: 'badge-success',
  WONT_FIX: 'badge-neutral',
};

const STATUS_OPTIONS: FeedbackStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX'];
const TYPE_OPTIONS: FeedbackType[] = ['BUG', 'FEATURE_REQUEST', 'GENERAL'];
const SEVERITY_OPTIONS: FeedbackSeverity[] = ['LOW', 'MEDIUM', 'HIGH'];

/** Fetch a short-lived signed URL and open the attachment in a new tab. */
async function openAttachment(feedbackId: string, attachmentId: string, onError: (msg: string) => void) {
  try {
    const url = await feedbackApi.getAttachmentUrl(feedbackId, attachmentId);
    window.open(url, '_blank', 'noopener');
  } catch (err: any) {
    onError(err?.response?.data?.error ?? "Couldn't open that attachment. Try again.");
  }
}

function AttachmentChips({ feedback }: { feedback: Feedback }) {
  const [error, setError] = useState('');
  if (feedback.attachments.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {feedback.attachments.map((a) => (
          <button
            key={a.id}
            type="button"
            className="flex items-center gap-1.5 bg-grey-50 border border-grey-200 rounded-lg px-2 py-1 text-xs text-grey-700 hover:text-navy-700 hover:border-gold-500 transition-colors max-w-56"
            title={`Open ${a.originalName}`}
            onClick={() => openAttachment(feedback.id, a.id, setError)}
          >
            <span aria-hidden>{a.kind === 'IMAGE' ? '🖼' : '📄'}</span>
            <span className="truncate font-medium">{a.originalName}</span>
            <span className="text-grey-500 shrink-0">{formatBytes(a.sizeBytes)}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-error text-xs">{error}</p>}
    </div>
  );
}

// ── Submit form (everyone) ────────────────────────────────────────────────────

function SubmitFeedbackCard() {
  const createFeedback = useCreateFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<FeedbackType>('BUG');
  const [severity, setSeverity] = useState<FeedbackSeverity | ''>('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFileError('');
    const additions: File[] = [];
    for (const file of Array.from(list)) {
      if (files.length + additions.length >= MAX_FEEDBACK_ATTACHMENTS) {
        setFileError(`You can attach at most ${MAX_FEEDBACK_ATTACHMENTS} files.`);
        break;
      }
      const reason = rejectFileReason(file);
      if (reason) {
        setFileError(reason);
        continue;
      }
      additions.push(file);
    }
    if (additions.length) setFiles((cur) => [...cur, ...additions]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setNotice('');
    try {
      await createFeedback.mutateAsync({
        type,
        severity: type === 'BUG' && severity ? severity : undefined,
        subject: subject.trim(),
        description: description.trim(),
        pageContext: window.location.pathname,
        files,
      });
      setType('BUG'); setSeverity(''); setSubject(''); setDescription(''); setFiles([]); setFileError('');
      setNotice('Thanks — your feedback has been submitted.');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't submit your feedback. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4">
      <h2 className="font-display font-bold text-lg text-grey-900">Submit Feedback</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-grey-600 font-medium mb-1">Type</label>
          <select className="input text-sm" value={type} onChange={(e) => setType(e.target.value as FeedbackType)}>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        {type === 'BUG' && (
          <div>
            <label className="block text-xs text-grey-600 font-medium mb-1">Severity (optional)</label>
            <select className="input text-sm" value={severity} onChange={(e) => setSeverity(e.target.value as FeedbackSeverity | '')}>
              <option value="">Not sure</option>
              {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-grey-600 font-medium mb-1">Subject</label>
        <input
          className="input text-sm"
          placeholder={type === 'BUG' ? 'e.g. Score resets when I undo a point' : 'A short summary'}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          required
        />
      </div>

      <div>
        <label className="block text-xs text-grey-600 font-medium mb-1">Description</label>
        <textarea
          className="input text-sm resize-y min-h-28"
          placeholder={type === 'BUG' ? 'What happened, what you expected, and steps to reproduce…' : 'Tell us more…'}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          required
        />
      </div>

      {/* Attachments — same picker pattern as team chat, capped at 5. */}
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={CHAT_ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = ''; // allow re-selecting the same file
          }}
        />
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-2 bg-grey-100 border border-grey-200 rounded-lg pl-2 pr-2 py-1.5 max-w-56">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-grey-900 truncate">{f.name}</p>
                  <p className="text-[10px] text-grey-600">{formatBytes(f.size)}</p>
                </div>
                <button
                  type="button"
                  className="text-grey-600 hover:text-error text-sm leading-none px-0.5"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => { setFiles((cur) => cur.filter((_, idx) => idx !== i)); setFileError(''); }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="btn-ghost text-xs px-3 py-1.5"
          onClick={() => fileInputRef.current?.click()}
        >
          + Attach files ({files.length}/{MAX_FEEDBACK_ATTACHMENTS})
        </button>
        {fileError && <p className="text-error text-xs">{fileError}</p>}
      </div>

      {error && <p className="text-error text-xs">{error}</p>}
      {notice && <p className="text-sm text-grey-900 bg-gold-500/10 rounded-lg px-3 py-2">{notice}</p>}

      <button type="submit" className="btn-primary text-sm" disabled={createFeedback.isPending}>
        {createFeedback.isPending ? 'Submitting…' : 'Submit Feedback'}
      </button>
    </form>
  );
}

// ── Your Feedback (everyone) ──────────────────────────────────────────────────

function MyFeedbackCard({ fb }: { fb: Feedback }) {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-grey-900 text-base">{fb.subject}</p>
          <p className="text-grey-500 text-xs mt-0.5">
            Submitted {new Date(fb.createdAt).toLocaleDateString()}
            {fb.severity && ` · ${fb.severity.charAt(0) + fb.severity.slice(1).toLowerCase()} severity`}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0 mt-0.5">
          <span className={`badge ${TYPE_BADGE[fb.type]}`}>{TYPE_LABELS[fb.type]}</span>
          <span className={`badge ${STATUS_BADGE[fb.status]}`}>{STATUS_LABELS[fb.status]}</span>
        </div>
      </div>

      <p className="text-grey-700 text-sm whitespace-pre-wrap">{fb.description}</p>

      <AttachmentChips feedback={fb} />

      {fb.adminNotes && (
        <div className="bg-navy-100/50 border border-navy-100 rounded-lg px-3 py-2">
          <p className="text-xs font-semibold text-navy-700 mb-0.5">Response from the VolleyVision team</p>
          <p className="text-sm text-grey-900 whitespace-pre-wrap">{fb.adminNotes}</p>
        </div>
      )}
    </div>
  );
}

function MyFeedbackSection() {
  const { data: mine, isLoading } = useMyFeedback();

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-grey-600">Your Feedback</h2>
      {isLoading ? (
        <p className="text-grey-600 text-sm">Loading your feedback…</p>
      ) : !mine?.length ? (
        <div className="card p-8 text-center">
          <p className="text-grey-900 font-medium">Nothing submitted yet</p>
          <p className="text-grey-600 text-sm mt-1">Bug reports and ideas you submit will appear here with their status.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mine.map((fb) => <MyFeedbackCard key={fb.id} fb={fb} />)}
        </div>
      )}
    </section>
  );
}

// ── All Feedback (ADMIN only) ─────────────────────────────────────────────────

function AdminFeedbackRow({ fb }: { fb: Feedback }) {
  const updateStatus = useUpdateFeedbackStatus();
  const [status, setStatus] = useState<FeedbackStatus>(fb.status);
  const [notes, setNotes] = useState(fb.adminNotes ?? '');
  const [error, setError] = useState('');

  const dirty = status !== fb.status || notes.trim() !== (fb.adminNotes ?? '');

  async function save() {
    setError('');
    try {
      await updateStatus.mutateAsync({ id: fb.id, data: { status, adminNotes: notes.trim() || null } });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't save. Try again.");
    }
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-grey-900 text-sm">{fb.subject}</p>
          <p className="text-grey-500 text-xs mt-0.5">
            {fb.user ? `${fb.user.firstName} ${fb.user.lastName} · ${fb.user.email}` : 'Unknown user'}
            {' · '}{new Date(fb.createdAt).toLocaleString()}
            {fb.severity && ` · ${fb.severity.charAt(0) + fb.severity.slice(1).toLowerCase()} severity`}
            {fb.pageContext && ` · from ${fb.pageContext}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`badge ${TYPE_BADGE[fb.type]}`}>{TYPE_LABELS[fb.type]}</span>
          <select
            className="input text-xs py-1.5 w-auto"
            value={status}
            aria-label={`Status for "${fb.subject}"`}
            onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      <p className="text-grey-700 text-sm whitespace-pre-wrap">{fb.description}</p>

      <AttachmentChips feedback={fb} />

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs text-grey-600 font-medium mb-1">Admin notes (visible to the submitter)</label>
          <textarea
            className="input text-sm resize-y min-h-16"
            placeholder="What was done about it…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={5000}
          />
        </div>
        <button
          type="button"
          className="btn-primary text-xs px-3 py-2 shrink-0"
          disabled={!dirty || updateStatus.isPending}
          onClick={save}
        >
          {updateStatus.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="text-error text-xs">{error}</p>}
    </div>
  );
}

function AdminFeedbackSection() {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const { data: all, isLoading } = useAllFeedback({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  });

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-grey-600">All Feedback (admin)</h2>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-grey-600 mb-1">Status</label>
          <select className="input text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-grey-600 mb-1">Type</label>
          <select className="input text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-grey-600 text-sm">Loading all feedback…</p>
      ) : !all?.length ? (
        <div className="card p-8 text-center">
          <p className="text-grey-900 font-medium">No feedback{statusFilter || typeFilter ? ' matching these filters' : ' yet'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-grey-200">
          {all.map((fb) => <AdminFeedbackRow key={fb.id} fb={fb} />)}
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display font-bold text-2xl text-grey-900">Feedback</h1>
        <p className="text-grey-600 text-sm mt-0.5">Report a bug or share an idea — we read everything</p>
      </div>

      <SubmitFeedbackCard />
      <MyFeedbackSection />
      {isAdmin && <AdminFeedbackSection />}
    </div>
  );
}
