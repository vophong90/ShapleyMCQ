"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function Sparkline({ data }: { data: any[] }) {
  return (
    <div className="w-full h-10">
      <ResponsiveContainer>
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"   // ✅ khớp với API sparklineMcq
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
