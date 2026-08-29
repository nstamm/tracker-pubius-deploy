import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ExpensesFiltersProps {
  selectedMonth: string;
  selectedCategory: string;
  onMonthChange: (month: string) => void;
  onCategoryChange: (category: string) => void;
}

const categories = ["Todas", "Comidas", "Viajes", "Servicios", "Personal"];

const months = [
  { value: "all", label: "Todos los meses" },
  { value: "0", label: "Enero" },
  { value: "1", label: "Febrero" },
  { value: "2", label: "Marzo" },
  { value: "3", label: "Abril" },
  { value: "4", label: "Mayo" },
  { value: "5", label: "Junio" },
  { value: "6", label: "Julio" },
  { value: "7", label: "Agosto" },
  { value: "8", label: "Septiembre" },
  { value: "9", label: "Octubre" },
  { value: "10", label: "Noviembre" },
  { value: "11", label: "Diciembre" },
];

export const ExpensesFilters = ({
  selectedMonth,
  selectedCategory,
  onMonthChange,
  onCategoryChange,
}: ExpensesFiltersProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border bg-card">
      <div className="space-y-2">
        <Label>Mes</Label>
        <Select value={selectedMonth} onValueChange={onMonthChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Categoría</Label>
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
