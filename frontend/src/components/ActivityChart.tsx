'use client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const chartData = [
  { name: 'Mon', apps: 4, mtgs: 2 },
  { name: 'Tue', apps: 7, mtgs: 5 },
  { name: 'Wed', apps: 5, mtgs: 3 },
  { name: 'Thu', apps: 8, mtgs: 4 },
  { name: 'Fri', apps: 6, mtgs: 6 },
  { name: 'Sat', apps: 2, mtgs: 1 },
  { name: 'Sun', apps: 3, mtgs: 2 },
];

export default function ActivityChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#d4a843" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#d4a843" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#111d35', border: '1px solid rgba(212, 168, 67, 0.2)', borderRadius: 12 }}
          itemStyle={{ color: '#f0d078' }}
        />
        <Area type="monotone" dataKey="apps" stroke="#d4a843" strokeWidth={3} fillOpacity={1} fill="url(#colorApps)" />
        <Area type="monotone" dataKey="mtgs" stroke="#8b5cf6" strokeWidth={3} fill="transparent" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
