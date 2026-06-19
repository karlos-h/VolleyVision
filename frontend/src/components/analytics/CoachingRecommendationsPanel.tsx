import type { Recommendation } from '../../types';

interface Props {
  recommendations: Recommendation[];
}

const CATEGORY_LABELS: Record<Recommendation['category'], string> = {
  attack:   'Attack',
  serve:    'Serve',
  pass:     'Pass',
  defence:  'Defence',
  rotation: 'Rotation',
};

export default function CoachingRecommendationsPanel({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <div className="card p-6 text-center text-chalk-400 text-sm">
        No recommendations — stats are within healthy ranges.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recommendations.map((rec, i) => (
        <div
          key={i}
          className={`rounded-lg p-3 text-sm flex gap-3 items-start ${
            rec.priority === 'high'
              ? 'bg-red-500/10 border border-red-500/20'
              : rec.priority === 'medium'
              ? 'bg-yellow-500/10 border border-yellow-500/20'
              : 'bg-chalk-500/10 border border-chalk-700/30'
          }`}
        >
          <div className="shrink-0 flex flex-col gap-1 pt-0.5">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                rec.priority === 'high'
                  ? 'bg-red-500/20 text-red-400'
                  : rec.priority === 'medium'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-chalk-500/20 text-chalk-400'
              }`}
            >
              {rec.priority}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-chalk-500 text-center">
              {CATEGORY_LABELS[rec.category]}
            </span>
          </div>
          <p
            className={
              rec.priority === 'high'
                ? 'text-red-300'
                : rec.priority === 'medium'
                ? 'text-yellow-300'
                : 'text-chalk-300'
            }
          >
            {rec.message}
          </p>
        </div>
      ))}
    </div>
  );
}
