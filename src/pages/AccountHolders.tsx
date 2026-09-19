import { useEffect, useState } from "react";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage, type AccountHolder } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const AccountHolders = () => {
  const [items, setItems] = useState<AccountHolder[]>([]);
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [editing, setEditing] = useState<AccountHolder | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => { try { setItems(await api.accountHolders.list()); } catch (error) { toast.error(getErrorMessage(error, "No se pudieron cargar las cuentas")); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);

  const reset = () => { setName(""); setBank(""); setEditing(null); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !bank.trim()) return toast.error("Completá nombre y banco");
    try {
      if (editing) await api.accountHolders.update(editing.id, { name: name.trim(), bank: bank.trim() });
      else await api.accountHolders.create({ name: name.trim(), bank: bank.trim() });
      toast.success(editing ? "Titular actualizado" : "Titular agregado");
      reset(); await load();
    } catch (error) { toast.error(getErrorMessage(error, "No se pudo guardar")); }
  };
  const startEdit = (item: AccountHolder) => { setEditing(item); setName(item.name); setBank(item.bank); };
  const remove = async (id: string) => { try { await api.accountHolders.remove(id); toast.success("Titular eliminado"); await load(); } catch (error) { toast.error(getErrorMessage(error, "No se pudo eliminar")); } };

  return <div className="min-h-screen bg-background p-4 md:p-8"><div className="mx-auto max-w-4xl space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Configuración</p><h1 className="text-2xl font-semibold">Titulares de cuenta</h1><p className="text-sm text-muted-foreground">Administrá las cuentas y bancos disponibles para asignar operaciones.</p></div>
    <Card><CardHeader><CardTitle>{editing ? "Editar titular" : "Agregar titular"}</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-2"><Label htmlFor="account-holder-name">Nombre</Label><Input id="account-holder-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Juan Pérez" /></div>
      <div className="space-y-2"><Label htmlFor="account-holder-bank">Banco</Label><Input id="account-holder-bank" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Ej. Mercury" /></div>
      <div className="flex gap-2"><Button type="submit"><Plus className="mr-2 h-4 w-4" />{editing ? "Guardar" : "Agregar"}</Button>{editing && <Button type="button" variant="outline" onClick={reset}>Cancelar</Button>}</div>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle>Cuentas registradas ({items.length})</CardTitle></CardHeader><CardContent>{loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : items.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay titulares de cuenta.</p> : <div className="divide-y">{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-3"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Landmark className="h-4 w-4" /></div><div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.bank}</p></div></div><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => startEdit(item)}><Pencil className="h-4 w-4" /></Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar titular?</AlertDialogTitle><AlertDialogDescription>Las operaciones asociadas quedarán sin titular de cuenta.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(item.id)}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></div>)}</div>}</CardContent></Card>
  </div></div>;
};
export default AccountHolders;
