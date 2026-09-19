import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Pencil, Check, X, Eye } from "lucide-react";
import { api, getErrorMessage, type OperationInput } from "@/lib/api";
import type { AccountHolder, Client } from "@/lib/api";
import ClientSelect from "@/components/ClientSelect";
import AccountHolderSelect from "@/components/AccountHolderSelect";
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
  client_id: string | null;
  account_holder_id: string | null;
  monto_total: number;
  porcentaje_ganancia: number;
  ganancia: number;
  tipo_operacion: string;
}

interface OperationsTableProps {
  operations: Operation[];
  clients: Client[];
  accountHolders: AccountHolder[];
  onUpdate: () => void;
  onDelete: () => void;
}

type EditableOperationField = "fecha_operacion" | "monto_total" | "porcentaje_ganancia" | "tipo_operacion" | "client_id" | "account_holder_id";

const operationTypes = ["Zelle", "Paypal", "Skrill", "Binance", "Slash", "Mercury", "Venmo", "Cash App", "Chime", "Comisión", "A definir"];

const initialNewOperation = (accountHolderId: string | null = null) => ({
  fecha_operacion: new Date().toISOString().split("T")[0],
  tipo_operacion: "",
  client_id: null as string | null,
  account_holder_id: accountHolderId,
  monto_total: "",
  porcentaje_ganancia: "",
});

const getTypeBadgeColor = (tipo: string) => {
  const lowerTipo = tipo?.toLowerCase() || "";
  if (lowerTipo.includes("zelle")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (lowerTipo.includes("paypal")) return "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
  if (lowerTipo.includes("skrill")) return "bg-purple-500/20 text-purple-400 border-purple-500/30";
  if (lowerTipo.includes("binance")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (lowerTipo.includes("slash")) return "bg-rose-900/30 text-rose-300 border-rose-800/30";
  if (lowerTipo.includes("mercury")) return "bg-white text-black border-white/30";
  if (lowerTipo.includes("venmo")) return "bg-sky-500/20 text-sky-400 border-sky-500/30";
  if (lowerTipo.includes("cash app")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (lowerTipo.includes("chime")) return "bg-lime-500/20 text-lime-400 border-lime-500/30";
  if (lowerTipo.includes("comisión") || lowerTipo.includes("comision")) return "bg-green-500/20 text-green-400 border-green-500/30";
  return "bg-muted text-muted-foreground border-border";
};

const OperationsTable = ({ clients, accountHolders, operations, onUpdate, onDelete }: OperationsTableProps) => {
  const [editingCell, setEditingCell] = useState<{ id: string; field: EditableOperationField } | null>(null);
  const [editValue, setEditValue] = useState<string | number>("");
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const defaultAccountHolderId = accountHolders.find((holder) => holder.name.trim().toLowerCase() === "pubius")?.id ?? null;
  const [newOperation, setNewOperation] = useState(() => initialNewOperation());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setNewOperation((current) => current.account_holder_id ? current : { ...current, account_holder_id: defaultAccountHolderId });
  }, [defaultAccountHolderId]);

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

  const saveField = async (id: string, field: EditableOperationField, value: string | number | null, operation: Operation) => {
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

  const handleCreate = async () => {
    const amount = Number(newOperation.monto_total);
    const percentage = newOperation.tipo_operacion === "Comisión" ? 100 : Number(newOperation.porcentaje_ganancia);

    if (!newOperation.tipo_operacion) {
      toast.error("Elegí el tipo de operación");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(percentage) || percentage < 0) {
      toast.error("Completá monto y ganancia con valores válidos");
      return;
    }

    setCreating(true);
    try {
      await api.operations.create({
        fecha_operacion: newOperation.fecha_operacion,
        id_operacion: "",
        cuenta_emisora: "",
        cuenta_receptora: "",
        client_id: newOperation.client_id,
        account_holder_id: newOperation.account_holder_id,
        monto_total: amount,
        porcentaje_ganancia: percentage,
        tipo_operacion: newOperation.tipo_operacion,
      });
      toast.success("Operación creada exitosamente");
      setNewOperation(initialNewOperation(defaultAccountHolderId));
      onUpdate();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al crear operación"));
    } finally {
      setCreating(false);
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
      <Table containerClassName="overflow-hidden" className="table-fixed text-xs [&_th]:h-9 [&_th]:px-1.5 [&_th]:py-1 [&_td]:px-1.5 [&_td]:py-1">
        <TableHeader>
          <TableRow className="bg-secondary/50 hover:bg-secondary/70">
            <SortableTableHead
              field="fecha_operacion"
              currentSort={sortConfig}
              onSort={handleSort}
              className="hidden w-[14%] xl:table-cell"
            >
              Fecha
            </SortableTableHead>
            <SortableTableHead
              field="tipo_operacion"
              currentSort={sortConfig}
              onSort={handleSort}
              className="w-[32%] sm:w-[26%] xl:w-[24%]"
            >
              Tipo / cliente
            </SortableTableHead>
            <SortableTableHead
              field="monto_total"
              currentSort={sortConfig}
              onSort={handleSort}
              className="w-[25%] text-right sm:w-[20%] xl:w-[18%]"
            >
              Monto Total
            </SortableTableHead>
            <SortableTableHead
              field="porcentaje_ganancia"
              currentSort={sortConfig}
              onSort={handleSort}
              className="hidden text-right sm:table-cell sm:w-[14%] xl:w-[13%]"
            >
              % Ganancia
            </SortableTableHead>
            <SortableTableHead
              field="ganancia"
              currentSort={sortConfig}
              onSort={handleSort}
              className="w-[25%] text-right sm:w-[20%] xl:w-[20%]"
            >
              Ganancia
            </SortableTableHead>
            <TableHead className="w-[10%] text-center sm:w-[8%]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-primary/5 hover:bg-primary/10">
            <TableCell className="hidden xl:table-cell">
              <Input
                type="date"
                value={newOperation.fecha_operacion}
                onChange={(e) => setNewOperation((current) => ({ ...current, fecha_operacion: e.target.value }))}
                className="h-8 bg-secondary/70 px-2 text-xs"
                aria-label="Fecha de la nueva operación"
              />
            </TableCell>
            <TableCell>
              <div className="space-y-1.5">
                <Select value={newOperation.tipo_operacion} onValueChange={(tipo_operacion) => setNewOperation((current) => ({
                  ...current,
                  tipo_operacion,
                  porcentaje_ganancia: tipo_operacion === "Comisión" ? "100" : current.tipo_operacion === "Comisión" ? "" : current.porcentaje_ganancia,
                }))}>
                  <SelectTrigger className="h-8 w-full min-w-0 bg-secondary/70 px-2 text-xs">
                    <SelectValue placeholder="Tipo de operación" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {operationTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
                <ClientSelect
                  clients={clients}
                  value={newOperation.client_id}
                  onValueChange={(client_id) => setNewOperation((current) => ({ ...current, client_id }))}
                />
                <AccountHolderSelect
                  accountHolders={accountHolders}
                  value={newOperation.account_holder_id}
                  onValueChange={(account_holder_id) => setNewOperation((current) => ({ ...current, account_holder_id }))}
                />
              </div>
            </TableCell>
            <TableCell>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newOperation.monto_total}
                onChange={(e) => setNewOperation((current) => ({ ...current, monto_total: e.target.value }))}
                placeholder="Monto"
                className="h-8 bg-secondary/70 text-right text-xs"
                aria-label="Monto de la nueva operación"
              />
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newOperation.tipo_operacion === "Comisión" ? "100" : newOperation.porcentaje_ganancia}
                onChange={(e) => setNewOperation((current) => ({ ...current, porcentaje_ganancia: e.target.value }))}
                disabled={newOperation.tipo_operacion === "Comisión"}
                placeholder="%"
                className="h-8 bg-secondary/70 text-right text-xs"
                aria-label="Porcentaje de ganancia de la nueva operación"
              />
            </TableCell>
            <TableCell className="text-right font-bold text-success text-xs md:text-sm">
              ${((Number(newOperation.monto_total) || 0) * ((newOperation.tipo_operacion === "Comisión" ? 100 : Number(newOperation.porcentaje_ganancia)) || 0) / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
            </TableCell>
            <TableCell className="text-center">
              <div className="flex justify-center gap-1">
                <Button type="button" size="icon" className="h-8 w-8" onClick={handleCreate} disabled={creating} aria-label="Crear operación">
                  <Check className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNewOperation(initialNewOperation(defaultAccountHolderId))} disabled={creating} aria-label="Limpiar nueva operación">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          {sortedOperations.map((operation) => {
            const isEditingFecha = editingCell?.id === operation.id && editingCell?.field === "fecha_operacion";
            const isEditingMonto = editingCell?.id === operation.id && editingCell?.field === "monto_total";
            const isEditingPorcentaje = editingCell?.id === operation.id && editingCell?.field === "porcentaje_ganancia";
            
            return (
              <TableRow key={operation.id} className="group hover:bg-secondary/30">
                {/* Fecha - Visible when the table has enough room */}
                <TableCell className="hidden font-medium xl:table-cell">
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
                <TableCell className="w-[32%] sm:w-[26%] xl:w-[24%]">
                  <div className="space-y-1.5">
                    <Select
                      value={operation.tipo_operacion}
                      onValueChange={(value) => saveField(operation.id, "tipo_operacion", value, operation)}
                    >
                      <SelectTrigger className="h-8 w-full min-w-0 border-0 bg-transparent px-1 hover:bg-secondary/50">
                        <Badge variant="outline" className={`max-w-full truncate ${getTypeBadgeColor(operation.tipo_operacion)}`}>
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
                        <SelectItem value="Venmo">Venmo</SelectItem>
                        <SelectItem value="Cash App">Cash App</SelectItem>
                        <SelectItem value="Chime">Chime</SelectItem>
                        <SelectItem value="Comisión">Comisión</SelectItem>
                        <SelectItem value="A definir">A definir</SelectItem>
                      </SelectContent>
                    </Select>
                    <ClientSelect
                      clients={clients}
                      value={operation.client_id}
                      onValueChange={(client_id) => saveField(operation.id, "client_id", client_id, operation)}
                    />
                    <AccountHolderSelect
                      accountHolders={accountHolders}
                      value={operation.account_holder_id}
                      onValueChange={(account_holder_id) => saveField(operation.id, "account_holder_id", account_holder_id, operation)}
                    />
                  </div>
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
                        <span className="block truncate font-mono text-xs md:text-sm">
                          ${operation.monto_total?.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(operation.id, "monto_total", operation.monto_total)}
                          className="text-muted-foreground hover:text-foreground hidden h-6 w-6 opacity-0 group-hover:opacity-100 xl:inline-flex"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>

                {/* Porcentaje Ganancia - Hidden on narrow screens */}
                <TableCell className="hidden text-right sm:table-cell">
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
                          className="text-muted-foreground hover:text-foreground hidden h-6 w-6 opacity-0 group-hover:opacity-100 xl:inline-flex"
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
                  <span className="block truncate">${operation.ganancia?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                </TableCell>

                {/* Acciones */}
                <TableCell className="text-center">
                  <div className="flex justify-center gap-1">
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
                                  <SelectItem value="Venmo">Venmo</SelectItem>
                                  <SelectItem value="Cash App">Cash App</SelectItem>
                                  <SelectItem value="Chime">Chime</SelectItem>
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
            <TableCell colSpan={2} className="hidden xl:table-cell text-right font-semibold">Totales:</TableCell>
            <TableCell className="xl:hidden font-semibold">Total</TableCell>
            <TableCell className="text-right font-bold text-xs md:text-sm">
              ${totals.monto_total.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
            </TableCell>
            <TableCell className="hidden text-right text-xs sm:table-cell">
              <span className="hidden md:inline">Promedio: </span>{totals.porcentaje_promedio.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
            </TableCell>
            <TableCell className="text-right font-bold text-success text-xs md:text-sm">
              ${totals.ganancia_total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableFooter>
      </Table>
  );
};

export default OperationsTable;
