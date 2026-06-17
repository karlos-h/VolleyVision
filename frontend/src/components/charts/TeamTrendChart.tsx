import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  title: string;
  data: any[];
  dataKey: string;
}

export default function TeamTrendChart({ title, data, dataKey }: Props) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-chalk-100 mb-3">
        {title}
    </h3>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#162d58" strokeDasharray="3 3" />
            <XAxis
              dataKey="opponent"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#162d58' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0a1628',
                border: '1px solid #162d58',
                borderRadius: '8px',
                color: '#f0f4f8',
              }}
              labelStyle={{ color: '#94a3b8' }}
            />

            <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#fbbf24"
            strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}