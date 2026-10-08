"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

export function ProgressChart({ data }: { data: Array<{ name: string; progress: number; color: string }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
        <Tooltip formatter={(value: number) => [`${value}%`, "Progress"]} />
        <Bar dataKey="progress" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TaskStatusChart({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" isAnimationActive={false}>
          {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
        </Pie>
        <Tooltip formatter={(value: number, name: string) => [`${value} tasks`, name]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
