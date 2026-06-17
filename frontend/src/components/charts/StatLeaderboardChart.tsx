import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import type { PlayerStatLine } from '../../types';

interface Props {
  title: string;
  players: PlayerStatLine[];
  metric: 'kills' | 'aces' | 'digs' | 'totalBlocks';
}

export default function StatLeaderboardChart({
  title,
  players,
  metric,
}: Props) {
  const navigate = useNavigate();
  const data = [...players]
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 5)
    .map((player) => ({
    id: player.player.id,
      name: `${player.player.firstName} ${player.player.lastName.charAt(0)}`,
      value: player[metric],
    }));

  return (
    <div className="card p-4">
      <h2 className="font-semibold text-chalk-100 mb-3">
        {title}
      </h2>
      <p className="text-xs text-chalk-400 mb-2">
        Click a player bar to view details
      </p>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => [value, title]}
              contentStyle={{
                backgroundColor: '#020617',
                border: '1px solid #1e40af',
                borderRadius: '8px',
                color: '#f8fafc',
              }}
              labelStyle={{
                color: '#f8fafc',
                fontWeight: 'bold',
              }}
            />
            <Bar
              dataKey="value"
              fill="#fbbf24"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(data) => {
                navigate(`/players/${data.id}/dashboard`);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}