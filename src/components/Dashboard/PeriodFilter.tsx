import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Period = "week" | "month" | "prevmonth" | "3months" | "year" | "all";

interface PeriodFilterProps {
  value: Period;
  onChange: (value: Period) => void;
}

const PeriodFilter = ({ value, onChange }: PeriodFilterProps) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full md:w-[180px] bg-secondary">
        <SelectValue placeholder="Seleccionar período" />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border z-50">
        <SelectItem value="week">Última semana</SelectItem>
        <SelectItem value="month">Último mes</SelectItem>
        <SelectItem value="prevmonth">Mes Anterior</SelectItem>
        <SelectItem value="3months">Últimos 3 meses</SelectItem>
        <SelectItem value="year">Último año</SelectItem>
        <SelectItem value="all">Todo</SelectItem>
      </SelectContent>
    </Select>
  );
};

export default PeriodFilter;
