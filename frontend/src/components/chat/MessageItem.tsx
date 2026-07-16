import { useState } from 'react';
import type { ChatMessage } from '../../types';

/** "just now" → "5m" → "3h" → "Tue 14:02" → "12 Jun" — courtside-glance sizes. */
export function formatMessageTime(iso: string): string {
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  if (hours < 24 * 7) {
    return `${then.toLocaleDateString(undefined, { weekday: 'short' })} ${then.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

interface MessageItemProps {
  message: ChatMessage;
  isOwn: boolean;
  /** Own-message actions need posting rights; moderators may delete any message. */
  canPost: boolean;
  canModerate: boolean;
  onEdit: (messageId: string, body: string) => void;
  onDelete: (messageId: string) => void;
  onRetry: (tempId: string) => void;
  onDiscardFailed: (tempId: string) => void;
}

export default function MessageItem({
  message,
  isOwn,
  canPost,
  canModerate,
  onEdit,
  onDelete,
  onRetry,
  onDiscardFailed,
}: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const isDeleted = !!message.deletedAt;
  const isFailed = message.sendState === 'failed';
  const isSending = message.sendState === 'sending';
  const senderName = message.sender
    ? `${message.sender.firstName} ${message.sender.lastName}`
    : 'Former member';
  const initials = message.sender
    ? `${message.sender.firstName[0] ?? ''}${message.sender.lastName[0] ?? ''}`
    : '—';

  function saveEdit() {
    const body = draft.trim();
    if (body && body !== message.body) onEdit(message.id, body);
    setEditing(false);
  }

  return (
    <div className="group flex items-start gap-3 px-5 py-2 hover:bg-grey-100/60">
      {message.sender?.profileImage ? (
        <img
          src={message.sender.profileImage}
          alt=""
          className="w-9 h-9 rounded-full object-cover shrink-0 mt-0.5"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center font-bold text-sm text-navy-700 shrink-0 mt-0.5">
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`text-sm font-semibold ${message.sender ? 'text-grey-900' : 'text-grey-600 italic'}`}>
            {senderName}
          </span>
          <span className="text-xs text-grey-600">
            {isSending ? 'sending…' : formatMessageTime(message.createdAt)}
          </span>
          {message.editedAt && !isDeleted && (
            <span className="text-xs text-grey-600 italic">(edited)</span>
          )}
        </div>

        {isDeleted ? (
          <p className="text-sm text-grey-600 italic mt-0.5">Message deleted</p>
        ) : editing ? (
          <div className="mt-1">
            <textarea
              className="input text-sm py-2"
              rows={2}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <div className="flex gap-2 mt-1.5">
              <button className="btn-primary text-xs px-3 py-1.5" onClick={saveEdit}>Save</button>
              <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <p className={`text-sm whitespace-pre-wrap break-words mt-0.5 ${isSending ? 'text-grey-600' : 'text-grey-900'}`}>
            {message.body}
          </p>
        )}

        {isFailed && (
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-error font-medium">Failed to send</span>
            <button className="text-xs font-semibold text-navy-700 hover:underline" onClick={() => onRetry(message.id)}>
              Retry
            </button>
            <button className="text-xs text-grey-600 hover:underline" onClick={() => onDiscardFailed(message.id)}>
              Discard
            </button>
          </div>
        )}
      </div>

      {!isDeleted && !message.sendState && !editing && (isOwn ? canPost : canModerate) && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
          {isOwn && canPost && (
            <button
              className="text-xs font-medium text-grey-600 hover:text-navy-700 px-1.5 py-1"
              onClick={() => { setDraft(message.body ?? ''); setEditing(true); }}
            >
              Edit
            </button>
          )}
          <button
            className="text-xs font-medium text-grey-600 hover:text-error px-1.5 py-1"
            onClick={() => onDelete(message.id)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
