import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage, type Client, type ClientInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

const emptyForm = (): ClientInput => ({ title: "", email: null, phone: null });

const Clients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState<ClientInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      setClients(await api.clients.list());
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudieron cargar los clientes"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const input = {
      title: formData.title.trim(),
      email: formData.email?.trim() || null,
      phone: formData.phone?.trim() || null,
    };

    try {
      if (editingId) {
        await api.clients.update(editingId, input);
        toast.success("Cliente actualizado");
      } else {
        await api.clients.create(input);
        toast.success("Cliente creado");
      }
      resetForm();
      await fetchClients();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar el cliente"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingId(client.id);
    setFormData({ title: client.title, email: client.email, phone: client.phone });
  };

  const handleDelete = async (client: Client) => {
    try {
      await api.clients.remove(client.id);
      toast.success("Cliente eliminado y operaciones desvinculadas");
      if (editingId === client.id) resetForm();
      await fetchClients();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar el cliente"));
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.12),transparent_32%),hsl(var(--background))]">
      <main className="mx-auto w-[calc(100vw-24px)] min-[415px]:w-[390px] space-y-4 overflow-x-hidden px-3 py-4 md:w-full md:max-w-5xl md:px-5">
        <header className="flex items-center gap-3 border-b border-border/70 pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <UsersRound className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Pubius tracker</p>
            <h1 className="text-lg font-semibold tracking-tight">Clientes</h1>
          </div>
        </header>

        <Card className="border-border/80 bg-card/90">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 px-4 py-3">
            <div>
              <CardTitle className="text-base">{editingId ? "Editar cliente" : "Nuevo cliente"}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">El título es obligatorio; email y teléfono son opcionales.</p>
            </div>
            {editingId && (
              <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 gap-1.5">
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="client-title">Título</Label>
                <Input id="client-title" required value={formData.title} onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))} placeholder="Nombre o empresa" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-email">Email</Label>
                <Input id="client-email" type="email" value={formData.email ?? ""} onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))} placeholder="contacto@empresa.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-phone">Teléfono</Label>
                <Input id="client-phone" type="tel" value={formData.phone ?? ""} onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))} placeholder="+54 11..." />
              </div>
              <Button type="submit" disabled={saving} className="gap-2 md:min-w-32">
                <Plus className="h-4 w-4" />
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Agregar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 bg-card/90">
          <CardHeader className="border-b border-border/70 px-4 py-3">
            <CardTitle className="text-base">Clientes registrados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-40 items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
              </div>
            ) : clients.length === 0 ? (
              <p className="flex min-h-40 items-center justify-center px-4 text-center text-sm text-muted-foreground">Todavía no hay clientes registrados.</p>
            ) : (
              <Table containerClassName="overflow-hidden" className="text-xs sm:text-sm">
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/70">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
                    <TableHead className="w-24 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.title}</TableCell>
                      <TableCell className="max-w-28 truncate text-muted-foreground sm:max-w-none">{client.email || "-"}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{client.phone || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(client)} aria-label={`Editar ${client.title}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label={`Eliminar ${client.title}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar {client.title}?</AlertDialogTitle>
                              <AlertDialogDescription>Las operaciones vinculadas quedarán sin cliente asignado.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(client)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Clients;
