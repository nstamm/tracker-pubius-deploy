import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Expense {
  id: string;
  nombre_gasto: string;
  monto: number;
  fecha: string;
  categoria: string;
}

interface ExpensesChartProps {
  expenses: Expense[];
  month: string;
}

export const ExpensesChart = ({ expenses, month }: ExpensesChartProps) => {
  const chartData = useMemo(() => {
    if (month === "all" || expenses.length === 0) {
      return [];
    }

    const currentYear = new Date().getFullYear();
    const monthDate = new Date(currentYear, parseInt(month), 1);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const daysInMonth = eachDayOfInterval({ start, end });

    const dailyTotals = daysInMonth.map((day) => {
      const dayString = format(day, "yyyy-MM-dd");
      const dayExpenses = expenses.filter((exp) => exp.fecha === dayString);
      const total = dayExpenses.reduce((sum, exp) => sum + Number(exp.monto), 0);

      return {
        date: format(day, "dd", { locale: es }),
        fullDate: dayString,
        total: parseFloat(total.toFixed(2)),
      };
    });

    return dailyTotals;
  }, [expenses, month]);

  if (month === "all" || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gráfico de Gastos Diarios</CardTitle>
          <CardDescription>
            Selecciona un mes específico para ver el gráfico de gastos diarios
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chartConfig = {
    total: {
      label: "Gasto Total",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos Diarios del Mes</CardTitle>
        <CardDescription>Total gastado por día</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${value}`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
