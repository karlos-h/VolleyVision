import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';
import { CHART_SERIES, CHART_GRID, CHART_TICK } from '../../lib/chartColors';

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
            <PolarGrid stroke={CHART_GRID} />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: CHART_TICK, fontSize: 12 }}
            />
            <Radar
              dataKey="value"
              stroke={CHART_SERIES[0]}
              fill={CHART_SERIES[0]}
              fillOpacity={0.25}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}