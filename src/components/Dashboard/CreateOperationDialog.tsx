import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { api, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowUpRight, Plus, Sparkles } from "lucide-react";

interface CreateOperationDialogProps {
  onSuccess: () => void;
}

const operationTypes = [
  { value: "Zelle", color: "border-blue-500/35 bg-blue-500/10 text-blue-300", active: "border-blue-400 bg-blue-500/20 shadow-[0_0_22px_rgba(59,130,246,0.15)]" },
  { value: "Paypal", color: "border-indigo-500/35 bg-indigo-500/10 text-indigo-300", active: "border-indigo-400 bg-indigo-500/20 shadow-[0_0_22px_rgba(99,102,241,0.15)]" },
  { value: "Skrill", color: "border-purple-500/35 bg-purple-500/10 text-purple-300", active: "border-purple-400 bg-purple-500/20 shadow-[0_0_22px_rgba(168,85,247,0.15)]" },
  { value: "Binance", color: "border-amber-500/35 bg-amber-500/10 text-amber-300", active: "border-amber-400 bg-amber-500/20 shadow-[0_0_22px_rgba(245,158,11,0.15)]" },
  { value: "Slash", color: "border-rose-700/40 bg-rose-950/35 text-rose-300", active: "border-rose-400 bg-rose-500/15 shadow-[0_0_22px_rgba(244,63,94,0.15)]" },
  { value: "Mercury", color: "border-white/25 bg-white/10 text-white", active: "border-white/60 bg-white/15 shadow-[0_0_22px_rgba(255,255,255,0.12)]" },
  { value: "Venmo", color: "border-sky-500/35 bg-sky-500/10 text-sky-300", active: "border-sky-400 bg-sky-500/20 shadow-[0_0_22px_rgba(14,165,233,0.15)]" },
  { value: "Cash App", color: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300", active: "border-emerald-400 bg-emerald-500/20 shadow-[0_0_22px_rgba(16,185,129,0.15)]" },
  { value: "Chime", color: "border-lime-500/35 bg-lime-500/10 text-lime-300", active: "border-lime-400 bg-lime-500/20 shadow-[0_0_22px_rgba(132,204,22,0.15)]" },
  { value: "Comisión", color: "border-green-500/35 bg-green-500/10 text-green-300", active: "border-green-400 bg-green-500/20 shadow-[0_0_22px_rgba(34,197,94,0.15)]" },
  { value: "A definir", color: "border-border bg-muted/50 text-muted-foreground", active: "border-muted-foreground/70 bg-muted text-foreground" },
] as const;

const initialFormData = () => ({
  fecha_operacion: new Date().toISOString().split("T")[0],
  id_operacion: "",
  cuenta_emisora: "",
  cuenta_receptora: "",
  monto_total: "",
  porcentaje_ganancia: "",
  tipo_operacion: "",
});

const CreateOperationDialog = ({ onSuccess }: CreateOperationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tipo_operacion) {
      toast.error("Elegí el tipo de operación");
      return;
    }
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
      setFormData(initialFormData());
      onSuccess();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al crear operación"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2 shadow-lg shadow-primary/15">
          <Plus className="h-4 w-4" />
          Nueva Operación
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        overlayClassName="bg-background/65 backdrop-blur-md"
        className="flex h-dvh w-full flex-col gap-0 overflow-hidden border-l border-border/80 bg-card/95 p-0 shadow-[-20px_0_70px_rgba(0,0,0,0.45)] sm:max-w-[540px]"
      >
        <SheetHeader className="border-b border-border/70 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_45%)] px-5 py-5 pr-14 text-left sm:px-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-lg shadow-primary/10">
            <Sparkles className="h-5 w-5" />
          </div>
          <SheetTitle className="text-xl">Nueva operación</SheetTitle>
          <SheetDescription>Registrá el movimiento en segundos.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="monto" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Monto total</Label>
                <span className="text-xs text-muted-foreground">USD</span>
              </div>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0"
                value={formData.monto_total}
                onChange={(e) => setFormData({ ...formData, monto_total: e.target.value })}
                required
                autoFocus
                placeholder="0.00"
                className="h-16 border-primary/25 bg-primary/5 px-4 text-3xl font-semibold tracking-tight shadow-inner shadow-primary/5 focus-visible:border-primary/60"
              />
            </div>
            <div className="space-y-2.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tipo de operación</Label>
              <div role="radiogroup" aria-label="Tipo de operación" className="grid grid-cols-3 gap-2">
                {operationTypes.map((type) => {
                  const selected = formData.tipo_operacion === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setFormData((current) => ({
                        ...current,
                        tipo_operacion: type.value,
                        porcentaje_ganancia: type.value === "Comisión" ? "100" : current.tipo_operacion === "Comisión" ? "" : current.porcentaje_ganancia,
                      }))}
                      className={cn(
                        "h-10 rounded-lg border px-2 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        type.color,
                        selected && type.active,
                      )}
                    >
                      {type.value}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fecha" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fecha</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={formData.fecha_operacion}
                  onChange={(e) => setFormData({ ...formData, fecha_operacion: e.target.value })}
                  required
                  className="bg-secondary/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="porcentaje" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ganancia (%)</Label>
                <Input
                  id="porcentaje"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.tipo_operacion === "Comisión" ? "100" : formData.porcentaje_ganancia}
                  onChange={(e) => setFormData({ ...formData, porcentaje_ganancia: e.target.value })}
                  disabled={formData.tipo_operacion === "Comisión"}
                  required
                  placeholder="0.00"
                  className={cn("bg-secondary/70", formData.tipo_operacion === "Comisión" && "cursor-not-allowed opacity-50")}
                />
              </div>
            </div>

            {formData.monto_total && formData.porcentaje_ganancia && (
              <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-gradient-to-br from-primary/15 to-success/5 px-4 py-3.5 shadow-inner shadow-primary/5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">Ganancia estimada</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    ${((parseFloat(formData.monto_total) * parseFloat(formData.porcentaje_ganancia)) / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-lg bg-primary/15 p-2 text-primary">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="id_op" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">ID de operación</Label>
              <Input
                id="id_op"
                value={formData.id_operacion}
                onChange={(e) => setFormData({ ...formData, id_operacion: e.target.value })}
                placeholder="OP-12345"
                className="bg-secondary/70"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="emisora" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cuenta emisora</Label>
              <Input
                id="emisora"
                value={formData.cuenta_emisora}
                onChange={(e) => setFormData({ ...formData, cuenta_emisora: e.target.value })}
                placeholder="Origen"
                className="bg-secondary/70"
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="receptora" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cuenta receptora</Label>
              <Input
                id="receptora"
                value={formData.cuenta_receptora}
                onChange={(e) => setFormData({ ...formData, cuenta_receptora: e.target.value })}
                placeholder="Destino"
                className="bg-secondary/70"
              />
            </div>
            </div>

            {formData.tipo_operacion === "Comisión" && (
              <p className="rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-xs text-success">Las comisiones se registran con 100% de ganancia.</p>
            )}
          </div>

          <div className="flex shrink-0 gap-3 border-t border-border/70 bg-card/90 px-5 py-4 backdrop-blur sm:px-6">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="flex-1 border-border/80 bg-secondary/50">Cancelar</Button>
            </SheetClose>
            <Button type="submit" className="flex-[1.4] gap-2 shadow-lg shadow-primary/20" disabled={loading}>
              <Plus className="h-4 w-4" />
              {loading ? "Creando..." : "Crear operación"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default CreateOperationDialog;
