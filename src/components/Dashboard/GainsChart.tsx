import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ChartData {
  date: string;
  ganancia: number;
  monto_total: number;
  [key: string]: string | number;
}

export type ChartGrouping = "type" | "client";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

interface GainsChartProps {
  data: ChartData[];
  series: ChartSeries[];
  grouping: ChartGrouping;
  onGroupingChange: (grouping: ChartGrouping) => void;
  compact?: boolean;
}

interface TooltipEntry {
  color: string;
  name: string;
  value: number;
  payload: ChartData;
}

interface LegendEntry {
  color: string;
  value: string;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
        <p className="text-sm text-muted-foreground mb-2">{data.date}</p>
        <p className="text-xs text-muted-foreground">Monto Total:</p>
        <p className="text-lg font-semibold text-foreground mb-2">
          ${data.monto_total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
        </p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="text-xs capitalize" style={{ color: entry.color }}>
                {entry.name}:
              </span>
              <span className="text-sm font-semibold" style={{ color: entry.color }}>
                ${entry.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }: { payload?: LegendEntry[] }) => {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap justify-center gap-3 pt-4">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <span 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[10px] text-muted-foreground capitalize">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const GainsChart = ({ data, series, grouping, onGroupingChange, compact = false }: GainsChartProps) => {
  return (
    <Card className={compact ? "flex h-full min-h-0 flex-col overflow-hidden border-border/80 bg-card/90 shadow-xl shadow-black/5" : "col-span-full overflow-hidden"}>
      <CardHeader className={compact ? "flex shrink-0 flex-row items-center justify-between gap-3 border-b border-border/70 px-4 py-3" : "flex flex-row items-center justify-between gap-3 p-4 md:p-6"}>
        <CardTitle className="text-base md:text-lg">Ganancias por {grouping === "type" ? "tipo" : "cliente"}</CardTitle>
        <Select value={grouping} onValueChange={(value) => onGroupingChange(value as ChartGrouping)}>
          <SelectTrigger className="h-8 w-[145px] bg-secondary text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50 border-border bg-popover">
            <SelectItem value="type">Por tipo</SelectItem>
            <SelectItem value="client">Por cliente</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className={compact ? "min-h-0 flex-1 p-3" : "w-full min-w-0 p-2 md:p-6"}>
        <div className={compact ? "h-[260px] w-full min-w-0 max-w-full lg:h-full" : "h-[200px] w-full min-w-0 max-w-full md:h-[400px]"}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
            <defs>
              {series.map((item) => (
                <linearGradient key={item.key} id={`color-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop 
                    offset="5%" 
                    stopColor={item.color}
                    stopOpacity={0.4} 
                  />
                  <stop 
                    offset="95%" 
                    stopColor={item.color}
                    stopOpacity={0.05} 
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              width={50}
              tickFormatter={(value) => {
                if (value >= 1000000) return `$${(value/1000000).toFixed(1)}M`;
                if (value >= 1000) return `$${(value/1000).toFixed(0)}K`;
                return `$${value}`;
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {series.map((item) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={item.color}
                strokeWidth={2.5}
                fill={`url(#color-${item.key})`}
                fillOpacity={1}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default GainsChart;
