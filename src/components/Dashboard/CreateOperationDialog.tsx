import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface CreateOperationDialogProps {
  onSuccess: () => void;
}

const CreateOperationDialog = ({ onSuccess }: CreateOperationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fecha_operacion: new Date().toISOString().split('T')[0],
    id_operacion: "",
    cuenta_emisora: "",
    cuenta_receptora: "",
    monto_total: "",
    porcentaje_ganancia: "",
    tipo_operacion: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const porcentaje = formData.tipo_operacion === "Comisión" ? 100 : parseFloat(formData.porcentaje_ganancia);
      await api.operations.create({
        fecha_operacion: formData.fecha_operacion,
        id_operacion: formData.id_operacion,
        cuenta_emisora: formData.cuenta_emisora,
        cuenta_receptora: formData.cuenta_receptora,
        monto_total: parseFloat(formData.monto_total),
        porcentaje_ganancia: porcentaje,
        tipo_operacion: formData.tipo_operacion,
      });

      toast.success("Operación creada exitosamente");
      setOpen(false);
      setFormData({
        fecha_operacion: new Date().toISOString().split('T')[0],
        id_operacion: "",
        cuenta_emisora: "",
        cuenta_receptora: "",
        monto_total: "",
        porcentaje_ganancia: "",
        tipo_operacion: "",
      });
      onSuccess();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al crear operación"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Operación
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nueva Operación</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha de Operación</Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha_operacion}
                onChange={(e) => setFormData({ ...formData, fecha_operacion: e.target.value })}
                required
                className="bg-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Operación</Label>
              <Select
                value={formData.tipo_operacion}
                onValueChange={(value) => {
                  if (value === "Comisión") {
                    setFormData({ ...formData, tipo_operacion: value, porcentaje_ganancia: "100" });
                  } else {
                    setFormData({ ...formData, tipo_operacion: value });
                  }
                }}
              >
                <SelectTrigger id="tipo" className="bg-secondary">
                  <SelectValue placeholder="Seleccionar tipo" />
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="id_op">ID Operación</Label>
            <Input
              id="id_op"
              value={formData.id_operacion}
              onChange={(e) => setFormData({ ...formData, id_operacion: e.target.value })}
              placeholder="OP-12345"
              className="bg-secondary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emisora">Cuenta Emisora</Label>
              <Input
                id="emisora"
                value={formData.cuenta_emisora}
                onChange={(e) => setFormData({ ...formData, cuenta_emisora: e.target.value })}
                placeholder="Zelle, Paypal, etc."
                className="bg-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receptora">Cuenta Receptora</Label>
              <Input
                id="receptora"
                value={formData.cuenta_receptora}
                onChange={(e) => setFormData({ ...formData, cuenta_receptora: e.target.value })}
                placeholder="Binance, Skrill, etc."
                className="bg-secondary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monto">Monto Total</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                value={formData.monto_total}
                onChange={(e) => setFormData({ ...formData, monto_total: e.target.value })}
                required
                placeholder="1000.00"
                className="bg-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="porcentaje">Porcentaje Ganancia (%)</Label>
              <Input
                id="porcentaje"
                type="number"
                step="0.01"
                value={formData.tipo_operacion === "Comisión" ? "100" : formData.porcentaje_ganancia}
                onChange={(e) => setFormData({ ...formData, porcentaje_ganancia: e.target.value })}
                disabled={formData.tipo_operacion === "Comisión"}
                required
                placeholder="5.00"
                className={`bg-secondary ${formData.tipo_operacion === "Comisión" ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              {formData.tipo_operacion === "Comisión" && (
                <p className="text-xs text-muted-foreground">Las comisiones siempre tienen 100% de ganancia</p>
              )}
            </div>
          </div>
          {formData.monto_total && formData.porcentaje_ganancia && (
            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Ganancia calculada:</p>
              <p className="text-2xl font-bold text-primary">
                ${((parseFloat(formData.monto_total) * parseFloat(formData.porcentaje_ganancia)) / 100).toFixed(2)}
              </p>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creando..." : "Crear Operación"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOperationDialog;
