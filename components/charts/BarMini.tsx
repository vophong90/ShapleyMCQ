"use client";

import { BarChart, Bar, ResponsiveContainer } from "recharts";

export default function BarMini({ data }: { data: any[] }) {
  return (
    <div className="w-full h-12">
      <ResponsiveContainer>
        <BarChart data={data}>
          <Bar dataKey="value" fill="#0ea5e9" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
