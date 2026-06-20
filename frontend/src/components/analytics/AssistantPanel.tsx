import { useState } from 'react';
import type { AssistantAnswer } from '../../types';

interface Props {
  onAsk: (question: string) => void;
  answer:  AssistantAnswer | undefined;
  isPending: boolean;
}

const EXAMPLE_QUESTIONS = [
  'What is our weakest rotation?',
  'Who is our most improved player?',
  'Which player needs the most attention?',
  'What should we practice this week?',
  'Are we improving this season?',
  'What are our biggest weaknesses?',
];

export default function AssistantPanel({ onAsk, answer, isPending }: Props) {
  const [question, setQuestion] = useState('');

  function submit() {
    const q = question.trim();
    if (!q) return;
    onAsk(q);
  }

  return (
    <div className="card p-5 space-y-4">
      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ask a coaching question…"
          className="flex-1 bg-court-900 border border-court-700 rounded-lg px-3 py-2 text-sm text-chalk-100 placeholder-chalk-600 focus:outline-none focus:border-chalk-500"
        />
        <button
          onClick={submit}
          disabled={isPending || !question.trim()}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-chalk-100 text-court-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-chalk-200 transition-colors"
        >
          {isPending ? 'Asking…' : 'Ask'}
        </button>
      </div>

      {/* Answer */}
      {isPending && (
        <div className="rounded-lg bg-court-800 p-4 animate-pulse">
          <div className="h-4 bg-court-700 rounded w-3/4 mb-2" />
          <div className="h-4 bg-court-700 rounded w-1/2" />
        </div>
      )}

      {!isPending && answer && (
        <div className={`rounded-lg p-4 text-sm ${
          answer.matchedIntent
            ? 'bg-court-800 border border-court-700 text-chalk-200'
            : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-200'
        }`}>
          <p className="whitespace-pre-line leading-relaxed">{answer.answer}</p>
        </div>
      )}

      {/* Example questions */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-chalk-500 mb-2">Try asking:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => { setQuestion(q); onAsk(q); }}
              className="text-xs px-3 py-1 rounded-full border border-court-700 text-chalk-400 hover:border-chalk-500 hover:text-chalk-200 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
