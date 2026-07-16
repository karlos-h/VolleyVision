import { useRef, useState } from 'react';

const MAX_LENGTH = 4000;

interface MessageComposerProps {
  onSend: (body: string) => void;
  disabled?: boolean;
}

export default function MessageComposer({ onSend, disabled }: MessageComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const overLimit = trimmed.length > MAX_LENGTH;

  function send() {
    if (!trimmed || overLimit || disabled) return;
    onSend(trimmed);
    setValue('');
    textareaRef.current?.focus();
  }

  return (
    <div className="border-t border-grey-200 p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          className="input text-sm py-2.5 resize-none"
          rows={value.includes('\n') ? 3 : 1}
          placeholder="Message your team…"
          aria-label="Message your team"
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className="btn-primary text-sm px-4 py-2.5 shrink-0"
          onClick={send}
          disabled={disabled || !trimmed || overLimit}
        >
          Send
        </button>
      </div>
      {(overLimit || trimmed.length > MAX_LENGTH - 500) && (
        <p className={`text-xs mt-1 ${overLimit ? 'text-error' : 'text-grey-600'}`}>
          {trimmed.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()} characters
          {overLimit && ' — too long to send'}
        </p>
      )}
    </div>
  );
}
