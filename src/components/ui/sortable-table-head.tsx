import { ArrowUp, ArrowDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SortableTableHeadProps {
  children: React.ReactNode;
  field: string;
  currentSort: { field: string; direction: 'asc' | 'desc' } | null;
  onSort: (field: string) => void;
  className?: string;
}

export const SortableTableHead = ({
  children,
  field,
  currentSort,
  onSort,
  className,
}: SortableTableHeadProps) => {
  const isActive = currentSort?.field === field;
  const direction = isActive ? currentSort.direction : null;

  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none hover:bg-secondary/80 transition-colors",
        className
      )}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="ml-1">
          {isActive ? (
            direction === "asc" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )
          ) : (
            <div className="h-3 w-3 opacity-0 group-hover:opacity-50">
              <ArrowUp className="h-3 w-3" />
            </div>
          )}
        </span>
      </div>
    </TableHead>
  );
};