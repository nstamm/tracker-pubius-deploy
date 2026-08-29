import { useState, useEffect, useCallback } from "react";
import { api, type Operation } from "@/lib/api";
import MetricCard from "@/components/Dashboard/MetricCard";
import PeriodFilter, { Period } from "@/components/Dashboard/PeriodFilter";
import TypeFilter, { OperationType } from "@/components/Dashboard/TypeFilter";
import GainsChart from "@/components/Dashboard/GainsChart";
import CreateOperationDialog from "@/components/Dashboard/CreateOperationDialog";
import VoiceAssistant from "@/components/VoiceAssistant";
import OperationsTable from "@/components/Dashboard/OperationsTable";
import { DollarSign, TrendingUp, Activity, BarChart3, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatLocalDate } from "@/lib/utils";

const Dashboard = () => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [previousOperations, setPreviousOperations] = useState<Operation[]>([]);
  const [period, setPeriod] = useState<Period>("month");
  const [typeFilter, setTypeFilter] = useState<OperationType>("all");
  const [loading, setLoading] = useState(true);

  const fetchOperations = useCallback(async () => {
    setLoading(true);
    try {
      // Apply date filter based on period
      const now = new Date();
      let startDate = new Date();
      let prevStartDate = new Date();
      let prevEndDate = new Date();
      let currentEndDate: Date | undefined;
      
      switch (period) {
        case "week":
          startDate.setDate(now.getDate() - 7);
          prevStartDate.setDate(now.getDate() - 14);
          prevEndDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          prevStartDate.setMonth(now.getMonth() - 2);
          prevEndDate.setMonth(now.getMonth() - 1);
          break;
        case "prevmonth":
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          currentEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
          prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
          prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0);
          break;
        case "3months":
          startDate.setMonth(now.getMonth() - 3);
          prevStartDate.setMonth(now.getMonth() - 6);
          prevEndDate.setMonth(now.getMonth() - 3);
          break;
        case "year":
          startDate.setFullYear(now.getFullYear() - 1);
          prevStartDate.setFullYear(now.getFullYear() - 2);
          prevEndDate.setFullYear(now.getFullYear() - 1);
          break;
        case "all":
          startDate = new Date(0);
          break;
      }

      const currentFilters = period === "all"
        ? {}
        : {
            from: startDate.toISOString().split("T")[0],
            ...(period === "prevmonth" && currentEndDate
              ? { to: currentEndDate.toISOString().split("T")[0] }
              : {}),
          };
      const previousFilters = period === "all"
        ? null
        : {
            from: prevStartDate.toISOString().split("T")[0],
            to: prevEndDate.toISOString().split("T")[0],
          };
      const [current, previous] = await Promise.all([
        api.operations.list(currentFilters),
        previousFilters ? api.operations.list(previousFilters) : Promise.resolve([]),
      ]);
      setOperations(current);
      setPreviousOperations(previous);
    } catch (error) {
      console.error("Error fetching operations:", error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchOperations();
  }, [fetchOperations]);

  // Auto-refresh when tab gets focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOperations();
      }
    };

    const handleFocus = () => {
      fetchOperations();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchOperations]);

  // Filter operations by type
  const filteredOperations = typeFilter === "all" 
    ? operations 
    : operations.filter(op => op.tipo_operacion === typeFilter);

  const filteredPreviousOperations = typeFilter === "all"
    ? previousOperations
    : previousOperations.filter(op => op.tipo_operacion === typeFilter);

  // Calculate metrics (exclude Comisión from average percentage)
  const operacionesParaPromedio = filteredOperations.filter(op => op.tipo_operacion !== "Comisión");
  const operacionesParaPromedioPrev = filteredPreviousOperations.filter(op => op.tipo_operacion !== "Comisión");
  
  const totalGains = filteredOperations.reduce((sum, op) => sum + (op.ganancia || 0), 0);
  const totalAmount = filteredOperations.reduce((sum, op) => sum + (op.monto_total || 0), 0);
  const avgGain = filteredOperations.length > 0 ? totalGains / filteredOperations.length : 0;
  const avgPercentage = operacionesParaPromedio.length > 0 
    ? operacionesParaPromedio.reduce((sum, op) => sum + (op.porcentaje_ganancia || 0), 0) / operacionesParaPromedio.length 
    : 0;

  // Calculate previous period metrics
  const totalGainsPrev = filteredPreviousOperations.reduce((sum, op) => sum + (op.ganancia || 0), 0);
  const totalAmountPrev = filteredPreviousOperations.reduce((sum, op) => sum + (op.monto_total || 0), 0);
  const avgGainPrev = filteredPreviousOperations.length > 0 ? totalGainsPrev / filteredPreviousOperations.length : 0;
  const avgPercentagePrev = operacionesParaPromedioPrev.length > 0
    ? operacionesParaPromedioPrev.reduce((sum, op) => sum + (op.porcentaje_ganancia || 0), 0) / operacionesParaPromedioPrev.length
    : 0;

  // Calculate percentage changes
  const calcPercentChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const gainsChange = calcPercentChange(totalGains, totalGainsPrev);
  const operationsChange = calcPercentChange(filteredOperations.length, filteredPreviousOperations.length);
  const avgPercentageChange = calcPercentChange(avgPercentage, avgPercentagePrev);

  // Prepare chart data with separate vectors for each operation type
  // First, get all unique operation types
  const allTypes = Array.from(new Set(filteredOperations.map(op => op.tipo_operacion?.toLowerCase() || "otros")));
  
  type ChartPoint = { date: string; ganancia: number; monto_total: number; [key: string]: string | number };
  const chartData = filteredOperations.reduce<ChartPoint[]>((acc, op) => {
    const date = formatLocalDate(op.fecha_operacion, { month: 'short', day: 'numeric' });
    const existing = acc.find((item) => item.date === date);
    const tipo = op.tipo_operacion?.toLowerCase() || "otros";
    
    if (existing) {
      existing.ganancia += op.ganancia || 0;
      existing.monto_total += op.monto_total || 0;
      existing[tipo] = Number(existing[tipo] ?? 0) + (op.ganancia || 0);
    } else {
      // Initialize all types with 0
      const newEntry: ChartPoint = {
        date,
        ganancia: op.ganancia || 0,
        monto_total: op.monto_total || 0,
      };
      allTypes.forEach(type => {
        newEntry[type] = type === tipo ? (op.ganancia || 0) : 0;
      });
      acc.push(newEntry);
    }
    return acc;
  }, []).reverse();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.12),transparent_32%),hsl(var(--background))] lg:h-dvh lg:overflow-hidden">
      <main className="mx-auto w-[calc(100vw-24px)] min-[415px]:w-[390px] space-y-4 overflow-x-hidden px-3 py-4 md:w-full md:max-w-none md:px-4 lg:flex lg:h-dvh lg:flex-col lg:gap-3 lg:space-y-0 lg:px-5 lg:py-4">
        <div className="flex shrink-0 flex-col justify-between gap-3 border-b border-border/70 pb-3 md:flex-row md:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Pubius tracker</p>
            <h1 className="text-lg font-semibold tracking-tight">Centro de operaciones</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <PeriodFilter value={period} onChange={setPeriod} />
              <TypeFilter value={typeFilter} onChange={setTypeFilter} />
            </div>
            <CreateOperationDialog onSuccess={fetchOperations} />
          </div>
        </div>

        <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <Card className="flex min-h-[520px] flex-col overflow-hidden border-border/80 bg-card/90 shadow-xl shadow-black/5 lg:min-h-0">
            <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-border/70 px-4 py-3">
              <div>
                <CardTitle className="text-base">Operaciones</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">{filteredOperations.length} en el período seleccionado</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchOperations}
                disabled={loading}
                className="h-8 gap-2 border-border/80 bg-background/50 px-2.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
              {loading ? (
                <div className="flex h-full min-h-40 items-center justify-center">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                </div>
              ) : filteredOperations.length === 0 ? (
                <p className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  No hay operaciones en este período
                </p>
              ) : (
                <OperationsTable operations={filteredOperations} onUpdate={fetchOperations} onDelete={fetchOperations} />
              )}
            </CardContent>
          </Card>

          <section className="grid min-h-[520px] gap-4 lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)]">
            <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-1">
              <MetricCard
                title="Ganancia total"
                value={`$${totalGains.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`}
                previousValue={period !== "all" ? `$${totalGainsPrev.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : undefined}
                percentageChange={period !== "all" ? gainsChange : undefined}
                secondaryValue={`$${totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`}
                secondaryLabel="Volumen"
                icon={DollarSign}
              />
              <MetricCard
                title="Operaciones"
                value={filteredOperations.length.toString()}
                previousValue={period !== "all" ? filteredPreviousOperations.length.toString() : undefined}
                percentageChange={period !== "all" ? operationsChange : undefined}
                icon={Activity}
              />
              <MetricCard
                title="Margen medio"
                value={`${avgPercentage.toFixed(2)}%`}
                previousValue={period !== "all" ? `${avgPercentagePrev.toFixed(2)}%` : undefined}
                percentageChange={period !== "all" ? avgPercentageChange : undefined}
                icon={BarChart3}
              />
            </div>

            <GainsChart data={chartData} compact />
          </section>
        </div>

        <VoiceAssistant onSuccess={fetchOperations} />
      </main>
    </div>
  );
};

export default Dashboard;
