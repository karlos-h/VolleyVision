import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  stats: {
    kills: number;
    aces: number;
    totalBlocks: number;
    digs: number;
    assists: number;
  };
}

export default function PlayerRadarChart({ stats }: Props) {
  const data = [
    {
      metric: 'Kills',
      value: stats.kills,
    },
    {
      metric: 'Aces',
      value: stats.aces,
    },
    {
      metric: 'Blocks',
      value: stats.totalBlocks,
    },
    {
      metric: 'Digs',
      value: stats.digs,
    },
    {
      metric: 'Assists',
      value: stats.assists,
    },
  ];

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold text-chalk-100 mb-4">
        Performance Profile
      </h2>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="#162d58" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
            />
            <Radar
              dataKey="value"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.25}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}