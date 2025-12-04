"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function DonutMini({ data }: { data: any[] }) {
  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444"];

  return (
    <div className="w-full h-20">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="bloom_level"
            innerRadius="60%"
            outerRadius="80%"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
