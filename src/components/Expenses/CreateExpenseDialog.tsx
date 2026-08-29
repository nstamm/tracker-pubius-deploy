import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";

interface CreateExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const categories = ["Comidas", "Viajes", "Servicios", "Personal"] as const;

export const CreateExpenseDialog = ({ open, onOpenChange, onSuccess }: CreateExpenseDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre_gasto: "",
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
    categoria: "Comidas" as typeof categories[number],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.expenses.create({
        nombre_gasto: formData.nombre_gasto,
        monto: parseFloat(formData.monto),
        fecha: formData.fecha,
        categoria: formData.categoria,
      });

      toast.success("Egreso creado exitosamente");
      onSuccess();
      onOpenChange(false);
      setFormData({
        nombre_gasto: "",
        monto: "",
        fecha: new Date().toISOString().split("T")[0],
        categoria: "Comidas",
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al crear el egreso"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Nuevo Egreso</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nombre_gasto">Nombre del Gasto</Label>
            <Input
              id="nombre_gasto"
              value={formData.nombre_gasto}
              onChange={(e) => setFormData({ ...formData, nombre_gasto: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="monto">Monto</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              value={formData.monto}
              onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="categoria">Categoría</Label>
            <Select
              value={formData.categoria}
              onValueChange={(value) => setFormData({ ...formData, categoria: value as typeof categories[number] })}
            >
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creando..." : "Crear Egreso"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
