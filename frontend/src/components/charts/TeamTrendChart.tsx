import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { CHART_SERIES, CHART_GRID, CHART_TICK, CHART_TOOLTIP_BG, CHART_TOOLTIP_TEXT } from '../../lib/chartColors';

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
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
            <XAxis
              dataKey="opponent"
              tick={{ fill: CHART_TICK, fontSize: 11 }}
              axisLine={{ stroke: CHART_GRID }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: CHART_TICK, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_TOOLTIP_BG,
                border: `1px solid ${CHART_GRID}`,
                borderRadius: '8px',
                color: CHART_TOOLTIP_TEXT,
              }}
              labelStyle={{ color: CHART_TICK }}
            />

            <Line
            type="monotone"
            dataKey={dataKey}
            stroke={CHART_SERIES[0]}
            strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}