import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const COLORS = ["#7c3aed", "#a78bfa", "#a0e8af", "#f6c445", "#e17b7b", "#59c9f9", "#a9dbeb", "#b3b0f8"];

export default function ChatSummaryChart({ chartData, chartType = "bar", labelKey = "name", valueKey = "value" }) {
  if (!Array.isArray(chartData) || !chartData.length) return null;

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey={valueKey}
            nameKey={labelKey}
            cx="50%" cy="50%"
            outerRadius={80}
            fill="#7c3aed"
            label
          >
            {chartData.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  // Default: Bar chart
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData}>
        <XAxis dataKey={labelKey} />
        <YAxis />
        <Tooltip />
        <Bar dataKey={valueKey} fill="#7c3aed" />
        <Legend />
      </BarChart>
    </ResponsiveContainer>
  );
}
