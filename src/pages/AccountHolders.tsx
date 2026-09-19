import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage, type Client, type ClientInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const emptyForm = (): ClientInput => ({ title: "", email: null, phone: null });

const AccountHolders = () => {
  const [holders, setHolders] = useState<Client[]>([]);
  const [form, setForm] = useState<ClientInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setHolders(await api.clients.list()); }
    catch (error) { toast.error(getErrorMessage(error, "No se pudieron cargar los titulares")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const reset = () => { setForm(emptyForm()); setEditingId(null); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const input = { title: form.title.trim(), email: form.email?.trim() || null, phone: form.phone?.trim() || null };
    try {
      if (editingId) { await api.clients.update(editingId, input); toast.success("Titular actualizado"); }
      else { await api.clients.create(input); toast.success("Titular creado"); }
      reset(); await load();
    } catch (error) { toast.error(getErrorMessage(error, "No se pudo guardar el titular")); }
    finally { setSaving(false); }
  };

  const remove = async (holder: Client) => {
    try { await api.clients.remove(holder.id); toast.success("Titular eliminado"); await load(); }
    catch (error) { toast.error(getErrorMessage(error, "No se pudo eliminar el titular")); }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Configuración</p>
          <h1 className="text-2xl font-semibold">Titulares de cuenta</h1>
          <p className="mt-1 text-sm text-muted-foreground">Administrá los titulares y asigná operaciones para filtrar resultados por cuenta.</p>
        </div>
        <Card>
          <CardHeader><CardTitle>{editingId ? "Editar titular" : "Agregar titular"}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
              <div className="space-y-1"><Label htmlFor="holder-title">Nombre</Label><Input id="holder-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej. Cuenta principal" required /></div>
              <div className="space-y-1"><Label htmlFor="holder-email">Email</Label><Input id="holder-email" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Opcional" /></div>
              <div className="space-y-1"><Label htmlFor="holder-phone">Teléfono</Label><Input id="holder-phone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Opcional" /></div>
              <div className="flex gap-2"><Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{editingId ? "Guardar" : "Agregar"}</Button>{editingId && <Button type="button" variant="outline" onClick={reset}><X className="h-4 w-4" /></Button>}</div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" /> Cuentas registradas</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="py-8 text-center text-muted-foreground">Cargando...</p> : holders.length === 0 ? <p className="py-8 text-center text-muted-foreground">Todavía no hay titulares.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Teléfono</TableHead><TableHead className="w-24 text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>{holders.map((holder) => <TableRow key={holder.id}><TableCell className="font-medium">{holder.title}</TableCell><TableCell>{holder.email || "—"}</TableCell><TableCell>{holder.phone || "—"}</TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditingId(holder.id); setForm({ title: holder.title, email: holder.email, phone: holder.phone }); }}><Pencil className="h-4 w-4" /></Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar titular?</AlertDialogTitle><AlertDialogDescription>Las operaciones quedarán sin titular asignado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(holder)}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></TableCell></TableRow>)}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default AccountHolders;
