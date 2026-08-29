import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Pencil, Check, X, Eye } from "lucide-react";
import { api, getErrorMessage, type OperationInput } from "@/lib/api";
import { toast } from "sonner";
import { formatLocalDate } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface Operation {
  id: string;
  fecha_operacion: string;
  id_operacion: string;
  cuenta_emisora: string;
  cuenta_receptora: string;
  monto_total: number;
  porcentaje_ganancia: number;
  ganancia: number;
  tipo_operacion: string;
}

interface OperationsTableProps {
  operations: Operation[];
  onUpdate: () => void;
  onDelete: () => void;
}

type EditableOperationField = "fecha_operacion" | "monto_total" | "porcentaje_ganancia" | "tipo_operacion";

const getTypeBadgeColor = (tipo: string) => {
  const lowerTipo = tipo?.toLowerCase() || "";
  if (lowerTipo.includes("zelle")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (lowerTipo.includes("paypal")) return "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
  if (lowerTipo.includes("skrill")) return "bg-purple-500/20 text-purple-400 border-purple-500/30";
  if (lowerTipo.includes("binance")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (lowerTipo.includes("slash")) return "bg-rose-900/30 text-rose-300 border-rose-800/30";
  if (lowerTipo.includes("mercury")) return "bg-white text-black border-white/30";
  if (lowerTipo.includes("comisión") || lowerTipo.includes("comision")) return "bg-green-500/20 text-green-400 border-green-500/30";
  return "bg-muted text-muted-foreground border-border";
};

const OperationsTable = ({ operations, onUpdate, onDelete }: OperationsTableProps) => {
  const [editingCell, setEditingCell] = useState<{ id: string; field: EditableOperationField } | null>(null);
  const [editValue, setEditValue] = useState<string | number>("");
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);

  const startEdit = (id: string, field: EditableOperationField, value: string | number) => {
    setEditingCell({ id, field });
    setEditValue(value);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string, field: EditableOperationField, operation: Operation) => {
    if (e.key === "Enter") {
      saveField(id, field, editValue, operation);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const saveField = async (id: string, field: EditableOperationField, value: string | number, operation: Operation) => {
    try {
      await api.operations.update(id, { [field]: value } as Partial<OperationInput>);

      toast.success("Campo actualizado");
      setEditingCell(null);
      setEditValue("");
      onUpdate();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al actualizar"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.operations.remove(id);
      toast.success("Operación eliminada");
      onDelete();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al eliminar"));
    }
  };

  const handleSort = (field: string) => {
    setSortConfig(prev => {
      if (prev?.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  // Sort operations
  const sortedOperations = useMemo(() => {
    if (!sortConfig) return operations;
    
    return [...operations].sort((a, b) => {
      const aValue = a[sortConfig.field as keyof Operation];
      const bValue = b[sortConfig.field as keyof Operation];
      
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });
  }, [operations, sortConfig]);

  // Calculate totals (exclude Comisión from average percentage)
  const totals = useMemo(() => {
    const operacionesParaPromedio = sortedOperations.filter(op => op.tipo_operacion !== "Comisión");
    
    return {
      monto_total: sortedOperations.reduce((sum, op) => sum + (op.monto_total || 0), 0),
      ganancia_total: sortedOperations.reduce((sum, op) => sum + (op.ganancia || 0), 0),
      porcentaje_promedio: operacionesParaPromedio.length > 0 
        ? operacionesParaPromedio.reduce((sum, op) => sum + (op.porcentaje_ganancia || 0), 0) / operacionesParaPromedio.length 
        : 0,
    };
  }, [sortedOperations]);

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/50 hover:bg-secondary/70">
            <SortableTableHead
              field="fecha_operacion"
              currentSort={sortConfig}
              onSort={handleSort}
              className="hidden md:table-cell"
            >
              Fecha
            </SortableTableHead>
            <SortableTableHead
              field="tipo_operacion"
              currentSort={sortConfig}
              onSort={handleSort}
            >
              Tipo
            </SortableTableHead>
            <SortableTableHead
              field="monto_total"
              currentSort={sortConfig}
              onSort={handleSort}
              className="text-right"
            >
              Monto Total
            </SortableTableHead>
            <SortableTableHead
              field="porcentaje_ganancia"
              currentSort={sortConfig}
              onSort={handleSort}
              className="text-right"
            >
              % Ganancia
            </SortableTableHead>
            <SortableTableHead
              field="ganancia"
              currentSort={sortConfig}
              onSort={handleSort}
              className="text-right"
            >
              Ganancia
            </SortableTableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOperations.map((operation) => {
            const isEditingFecha = editingCell?.id === operation.id && editingCell?.field === "fecha_operacion";
            const isEditingMonto = editingCell?.id === operation.id && editingCell?.field === "monto_total";
            const isEditingPorcentaje = editingCell?.id === operation.id && editingCell?.field === "porcentaje_ganancia";
            
            return (
              <TableRow key={operation.id} className="group hover:bg-secondary/30">
                {/* Fecha - Hidden on mobile */}
                <TableCell className="font-medium hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    {isEditingFecha ? (
                      <>
                        <Input
                          type="date"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, operation.id, "fecha_operacion", operation)}
                          className="h-8 bg-secondary"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => saveField(operation.id, "fecha_operacion", editValue, operation)}
                          className="text-success h-6 w-6"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={cancelEdit}
                          className="text-muted-foreground h-6 w-6"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {formatLocalDate(operation.fecha_operacion)}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(operation.id, "fecha_operacion", operation.fecha_operacion)}
                          className="text-muted-foreground hover:text-foreground h-6 w-6 opacity-0 group-hover:opacity-100"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>

                {/* Tipo - Visible on all screens */}
                <TableCell>
                  <Select
                    value={operation.tipo_operacion}
                    onValueChange={(value) => saveField(operation.id, "tipo_operacion", value, operation)}
                  >
                    <SelectTrigger className="h-8 w-[100px] md:w-[140px] border-0 bg-transparent hover:bg-secondary/50">
                      <Badge variant="outline" className={getTypeBadgeColor(operation.tipo_operacion)}>
                        {operation.tipo_operacion}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      <SelectItem value="Zelle">Zelle</SelectItem>
                      <SelectItem value="Paypal">Paypal</SelectItem>
                      <SelectItem value="Skrill">Skrill</SelectItem>
                      <SelectItem value="Binance">Binance</SelectItem>
                      <SelectItem value="Slash">Slash</SelectItem>
                      <SelectItem value="Mercury">Mercury</SelectItem>
                      <SelectItem value="Comisión">Comisión</SelectItem>
                      <SelectItem value="A definir">A definir</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Monto Total - Visible on all screens */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {isEditingMonto ? (
                      <>
                        <Input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(parseFloat(e.target.value))}
                          onKeyDown={(e) => handleKeyDown(e, operation.id, "monto_total", operation)}
                          className="h-8 text-right bg-secondary w-24 md:w-32"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => saveField(operation.id, "monto_total", editValue, operation)}
                          className="text-success h-6 w-6"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={cancelEdit}
                          className="text-muted-foreground h-6 w-6"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-xs md:text-sm">
                          ${operation.monto_total?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(operation.id, "monto_total", operation.monto_total)}
                          className="text-muted-foreground hover:text-foreground h-6 w-6 opacity-0 group-hover:opacity-100 hidden md:inline-flex"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>

                {/* Porcentaje Ganancia - Visible on all screens */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {isEditingPorcentaje ? (
                      <>
                        <Input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(parseFloat(e.target.value))}
                          onKeyDown={(e) => handleKeyDown(e, operation.id, "porcentaje_ganancia", operation)}
                          className="h-8 text-right bg-secondary w-20 md:w-24"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => saveField(operation.id, "porcentaje_ganancia", editValue, operation)}
                          className="text-success h-6 w-6"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={cancelEdit}
                          className="text-muted-foreground h-6 w-6"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs md:text-sm">{operation.porcentaje_ganancia}%</span>
                        {operation.tipo_operacion !== "Comisión" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(operation.id, "porcentaje_ganancia", operation.porcentaje_ganancia)}
                            className="text-muted-foreground hover:text-foreground h-6 w-6 opacity-0 group-hover:opacity-100 hidden md:inline-flex"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>

                {/* Ganancia - Visible on all screens (No editable) */}
                <TableCell className="text-right font-bold text-success text-xs md:text-sm">
                  ${operation.ganancia?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </TableCell>

                {/* Acciones */}
                <TableCell className="text-center">
                  <div className="flex justify-center gap-1 md:gap-2">
                    {/* Eye button - Only visible on mobile */}
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="md:hidden text-muted-foreground hover:text-foreground h-8 w-8"
                          onClick={() => setSelectedOperation(operation)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="bottom" className="h-[80vh] bg-background">
                        <SheetHeader>
                          <SheetTitle>Detalles de la Operación</SheetTitle>
                          <SheetDescription>
                            Ver y editar todos los campos de la operación
                          </SheetDescription>
                        </SheetHeader>
                        {selectedOperation && (
                          <div className="mt-6 space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Fecha</label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="date"
                                  defaultValue={selectedOperation.fecha_operacion}
                                  onBlur={(e) => {
                                    if (e.target.value !== selectedOperation.fecha_operacion) {
                                      saveField(selectedOperation.id, "fecha_operacion", e.target.value, selectedOperation);
                                    }
                                  }}
                                  className="bg-secondary"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Tipo</label>
                              <Select
                                defaultValue={selectedOperation.tipo_operacion}
                                onValueChange={(value) => saveField(selectedOperation.id, "tipo_operacion", value, selectedOperation)}
                              >
                                <SelectTrigger className="bg-secondary">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border z-50">
                                  <SelectItem value="Zelle">Zelle</SelectItem>
                                  <SelectItem value="Paypal">Paypal</SelectItem>
                                  <SelectItem value="Skrill">Skrill</SelectItem>
                                  <SelectItem value="Binance">Binance</SelectItem>
                                  <SelectItem value="Slash">Slash</SelectItem>
                                  <SelectItem value="Mercury">Mercury</SelectItem>
                                  <SelectItem value="Comisión">Comisión</SelectItem>
                                  <SelectItem value="A definir">A definir</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Monto Total</label>
                              <Input
                                type="number"
                                step="0.01"
                                defaultValue={selectedOperation.monto_total}
                                onBlur={(e) => {
                                  const newValue = parseFloat(e.target.value);
                                  if (newValue !== selectedOperation.monto_total) {
                                    saveField(selectedOperation.id, "monto_total", newValue, selectedOperation);
                                  }
                                }}
                                className="bg-secondary"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Porcentaje Ganancia</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={selectedOperation.tipo_operacion === "Comisión" ? 100 : selectedOperation.porcentaje_ganancia}
                                onBlur={(e) => {
                                  if (selectedOperation.tipo_operacion !== "Comisión") {
                                    const newValue = parseFloat(e.target.value);
                                    if (newValue !== selectedOperation.porcentaje_ganancia) {
                                      saveField(selectedOperation.id, "porcentaje_ganancia", newValue, selectedOperation);
                                    }
                                  }
                                }}
                                disabled={selectedOperation.tipo_operacion === "Comisión"}
                                className={`bg-secondary ${selectedOperation.tipo_operacion === "Comisión" ? 'opacity-50 cursor-not-allowed' : ''}`}
                              />
                              {selectedOperation.tipo_operacion === "Comisión" && (
                                <p className="text-xs text-muted-foreground">Las comisiones siempre tienen 100% de ganancia</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Ganancia (Calculada)</label>
                              <div className="p-3 bg-secondary rounded-md font-bold text-success">
                                ${selectedOperation.ganancia?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                            <div className="pt-4 border-t">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" className="w-full">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar Operación
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar operación?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente la operación.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(selectedOperation.id)}>
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        )}
                      </SheetContent>
                    </Sheet>
                    
                    {/* Delete button - Hidden on mobile, shown on desktop */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="hidden md:inline-flex text-destructive hover:text-destructive h-8 w-8">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar operación?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente la operación.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(operation.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-secondary/50 hover:bg-secondary/50">
            <TableCell colSpan={2} className="hidden md:table-cell text-right font-semibold">Totales:</TableCell>
            <TableCell className="md:hidden font-semibold">Total</TableCell>
            <TableCell className="text-right font-bold text-xs md:text-sm">
              ${totals.monto_total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </TableCell>
            <TableCell className="text-right text-xs">
              <span className="hidden md:inline">Promedio: </span>{totals.porcentaje_promedio.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
            </TableCell>
            <TableCell className="text-right font-bold text-success text-xs md:text-sm">
              ${totals.ganancia_total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
};

export default OperationsTable;
