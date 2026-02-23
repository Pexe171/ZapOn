import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts";
import { useTheme, alpha } from "@mui/material/styles";

const DonutChart = ({ value, data, colors }) => {
  const theme = useTheme();

  const chartData = Array.isArray(data) ? data : [];
  const chartColors = Array.isArray(colors) && colors.length ? colors : [theme.palette.primary.main];

  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={92}
          innerRadius={70}
          paddingAngle={3}
          stroke="none"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
          ))}

          <Label
            position="center"
            content={({ viewBox }) => {
              const { cx, cy } = viewBox || {};
              return (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan
                    x={cx}
                    y={cy - 2}
                    fontSize="42"
                    fontWeight="950"
                    fill={theme.palette.text.primary}
                  >
                    {`${safeValue}`}
                  </tspan>
                  <tspan
                    x={cx}
                    y={cy + 26}
                    fontSize="13"
                    fontWeight="900"
                    fill={alpha(theme.palette.text.secondary, 0.95)}
                    letterSpacing="0.9"
                  >
                    SCORE
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DonutChart;
