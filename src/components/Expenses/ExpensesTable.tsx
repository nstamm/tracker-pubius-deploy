import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { formatLocalDate } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Expense {
  id: string;
  nombre_gasto: string;
  monto: number;
  fecha: string;
  categoria: string;
  created_at: string;
}

interface ExpensesTableProps {
  expenses: Expense[];
  onUpdate: () => void;
}

const categories = ["Comidas", "Viajes", "Servicios", "Personal"] as const;

const categoryColors = {
  Comidas: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  Viajes: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  Servicios: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  Personal: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
};

export const ExpensesTable = ({ expenses, onUpdate }: ExpensesTableProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Expense>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const itemsPerPage = 10;

  const handleSort = (field: string) => {
    setSortConfig(prev => {
      if (prev?.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  // Sort expenses
  const sortedExpenses = useMemo(() => {
    if (!sortConfig) return expenses;
    
    return [...expenses].sort((a, b) => {
      const aValue = a[sortConfig.field as keyof Expense];
      const bValue = b[sortConfig.field as keyof Expense];
      
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });
  }, [expenses, sortConfig]);

  const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedExpenses = sortedExpenses.slice(startIndex, endIndex);

  const handleDelete = async (id: string) => {
    try {
      await api.expenses.remove(id);
      toast.success("Egreso eliminado");
      onUpdate();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al eliminar"));
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditValues(expense);
  };

  const handleSave = async (id: string) => {
    try {
      await api.expenses.update(id, {
        nombre_gasto: editValues.nombre_gasto,
        monto: editValues.monto,
        fecha: editValues.fecha,
        categoria: editValues.categoria as typeof categories[number],
      });
      toast.success("Egreso actualizado");
      setEditingId(null);
      onUpdate();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al actualizar"));
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      handleSave(id);
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const totalEgresos = sortedExpenses.reduce((sum, exp) => sum + Number(exp.monto), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Total de Egresos</p>
        <p className="text-2xl font-bold">${totalEgresos.toFixed(2)}</p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                field="fecha"
                currentSort={sortConfig}
                onSort={handleSort}
              >
                Fecha
              </SortableTableHead>
              <SortableTableHead
                field="nombre_gasto"
                currentSort={sortConfig}
                onSort={handleSort}
              >
                Nombre
              </SortableTableHead>
              <SortableTableHead
                field="categoria"
                currentSort={sortConfig}
                onSort={handleSort}
              >
                Categoría
              </SortableTableHead>
              <SortableTableHead
                field="monto"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right"
              >
                Monto
              </SortableTableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No hay egresos registrados
                </TableCell>
              </TableRow>
            ) : (
              paginatedExpenses.map((expense) => {
                const isEditing = editingId === expense.id;

                return (
                  <TableRow key={expense.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => !isEditing && handleEdit(expense)}>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editValues.fecha || ""}
                          onChange={(e) =>
                            setEditValues({ ...editValues, fecha: e.target.value })
                          }
                          onKeyDown={(e) => handleKeyDown(e, expense.id)}
                          className="h-8"
                        />
                      ) : (
                        formatLocalDate(expense.fecha)
                      )}
                    </TableCell>
                    <TableCell onClick={() => !isEditing && handleEdit(expense)}>
                      {isEditing ? (
                        <Input
                          value={editValues.nombre_gasto || ""}
                          onChange={(e) =>
                            setEditValues({ ...editValues, nombre_gasto: e.target.value })
                          }
                          onKeyDown={(e) => handleKeyDown(e, expense.id)}
                          className="h-8"
                        />
                      ) : (
                        expense.nombre_gasto
                      )}
                    </TableCell>
                    <TableCell onClick={() => !isEditing && handleEdit(expense)}>
                      {isEditing ? (
                        <Select
                          value={editValues.categoria || ""}
                          onValueChange={(value) =>
                            setEditValues({ ...editValues, categoria: value as typeof categories[number] })
                          }
                        >
                          <SelectTrigger className="h-8">
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
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border",
                            categoryColors[expense.categoria as keyof typeof categoryColors]
                          )}
                        >
                          {expense.categoria}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-right font-medium"
                      onClick={() => !isEditing && handleEdit(expense)}
                    >
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editValues.monto || ""}
                          onChange={(e) =>
                            setEditValues({ ...editValues, monto: parseFloat(e.target.value) })
                          }
                          onKeyDown={(e) => handleKeyDown(e, expense.id)}
                          className="h-8 text-right"
                        />
                      ) : (
                        `$${Number(expense.monto).toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSave(expense.id)}
                            className="h-8 px-2 text-xs"
                          >
                            Guardar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancel}
                            className="h-8 px-2 text-xs"
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(expense.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {Math.min(endIndex, sortedExpenses.length)} de{" "}
            {sortedExpenses.length} egresos
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-8 h-8 p-0"
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
