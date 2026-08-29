import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type OperationType = "all" | "Zelle" | "Paypal" | "Skrill" | "Binance" | "Slash" | "Mercury" | "Venmo" | "Cash App" | "Chime" | "A definir" | "Comisión";

interface TypeFilterProps {
  value: OperationType;
  onChange: (value: OperationType) => void;
}

const TypeFilter = ({ value, onChange }: TypeFilterProps) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full md:w-[180px] bg-secondary">
        <SelectValue placeholder="Tipo de operación" />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border z-50">
        <SelectItem value="all">Todos los tipos</SelectItem>
        <SelectItem value="Zelle">Zelle</SelectItem>
        <SelectItem value="Paypal">Paypal</SelectItem>
        <SelectItem value="Skrill">Skrill</SelectItem>
        <SelectItem value="Binance">Binance</SelectItem>
        <SelectItem value="Slash">Slash</SelectItem>
        <SelectItem value="Mercury">Mercury</SelectItem>
        <SelectItem value="Venmo">Venmo</SelectItem>
        <SelectItem value="Cash App">Cash App</SelectItem>
        <SelectItem value="Chime">Chime</SelectItem>
        <SelectItem value="Comisión">Comisión</SelectItem>
        <SelectItem value="A definir">A definir</SelectItem>
      </SelectContent>
    </Select>
  );
};

export default TypeFilter;
