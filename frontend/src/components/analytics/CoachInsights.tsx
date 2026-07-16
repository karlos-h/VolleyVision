import type { TeamInsight } from '../../types';

interface Props {
  insights: TeamInsight[];
}

export default function CoachInsights({
  insights,
}: Props) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="card p-4">
      <h2 className="text-lg font-semibold text-chalk-100 mb-4">
        Coach Insights
      </h2>

      <div className="space-y-2">
        {insights.map((insight, index) => (
          <div
            key={index}
            className={`rounded-lg p-3 text-sm ${
              insight.type === 'positive'
                ? 'bg-success/10 text-success'
                : insight.type === 'warning'
                ? 'bg-error/10 text-error'
                : 'bg-chalk-500/10 text-chalk-300'
            }`}
          >
            {insight.message}
          </div>
        ))}
      </div>
    </div>
  );
}