import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Scatter } from 'recharts';
import type { XAxisTickContentProps, ScatterShapeProps } from 'recharts';

export interface IntradayProfitChartProps {
  data: { time: string; value: number }[];
  strokeColor: string;
  axisTickColor: string;
  showValues: boolean;
}

const parseTimeToMinutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
};

const getMarketTypeFromTimes = (times: string[]) => {
  const minutes = times.map(parseTimeToMinutes).filter((value): value is number => value !== null);
  const maxMinutes = minutes.length ? Math.max(...minutes) : 0;
  return maxMinutes >= 16 * 60 ? 'HK' : 'A';
};

const getMarketTicks = (marketType: 'A' | 'HK') => (
  marketType === 'HK' ? ['09:30', '12:00', '13:00', '16:00'] : ['09:30', '11:30', '13:00', '15:00']
);

const IntradayProfitChart: React.FC<IntradayProfitChartProps> = ({
  data,
  strokeColor,
  axisTickColor,
  showValues
}) => {
  const intradayMarketType = getMarketTypeFromTimes(data.map(point => point.time));
  const intradayAxisTicks = getMarketTicks(intradayMarketType);
  const lastIntradayPoint = data.length > 0 ? data[data.length - 1] : null;

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-google-text-secondary dark:text-google-text-secondary-dark">
        暂无分时数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 16, right: 16, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="colorDayProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.12} />
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <XAxis
          dataKey="time"
          type="category"
          ticks={intradayAxisTicks}
          tick={(props: XAxisTickContentProps) => {
            const value = props?.payload?.value ?? '';
            const first = intradayAxisTicks[0];
            const last = intradayAxisTicks[intradayAxisTicks.length - 1];
            const text = String(value).replace(/^0/, '');
            const isFirst = value === first;
            const isLast = value === last;
            const textAnchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
            const dx = isFirst ? 4 : isLast ? -4 : 0;
            return (
              <text
                x={props.x}
                y={props.y}
                dy={10}
                dx={dx}
                textAnchor={textAnchor}
                fill={axisTickColor}
                fontSize={10}
              >
                {text}
              </text>
            );
          }}
          tickMargin={8}
          padding={{ left: 6, right: 6 }}
          axisLine={false}
          tickLine={false}
          interval={0}
          minTickGap={0}
        />
        <YAxis 
          domain={([dataMin, dataMax]) => {
            if (dataMin === dataMax) return [dataMin - 1, dataMax + 1];
            const padding = (dataMax - dataMin) * 0.1;
            return [dataMin - padding, dataMax + padding];
          }} 
          hide 
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1E1F20',
            borderColor: '#1E1F20',
            borderRadius: '12px',
            color: '#fff',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
          itemStyle={{ color: '#E3E3E3' }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, _name: any, item: any) => {
            if (item?.dataKey === undefined || item?.name === 'scatter') {
              return [null, null];
            }
            const numeric = typeof value === 'number' ? value : parseFloat(String(value));
            if (!Number.isFinite(numeric)) {
              return ['--', '当日盈亏'];
            }
            return [showValues ? numeric.toFixed(2) : '****', '当日盈亏'];
          }}
          labelFormatter={(label) => `${label}`}
        />
        <Area
          type="linear"
          dataKey="value"
          name="当日盈亏"
          stroke={strokeColor}
          fillOpacity={1}
          fill="url(#colorDayProfit)"
          strokeWidth={2}
          isAnimationActive={false}
          dot={false}
        />
        <Scatter
          data={lastIntradayPoint ? [lastIntradayPoint] : []}
          dataKey="value"
          name="scatter"
          isAnimationActive={false}
          shape={(props: ScatterShapeProps) => {
            const { cx, cy } = props;
            if (cx == null || cy == null) return null;
            return (
              <g>
                <circle cx={cx} cy={cy} r={6} fill={strokeColor} opacity={0.25} filter="url(#glow)">
                  <animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.25;0.6;0.25" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <circle cx={cx} cy={cy} r={2.5} fill={strokeColor} />
              </g>
            );
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default IntradayProfitChart;
