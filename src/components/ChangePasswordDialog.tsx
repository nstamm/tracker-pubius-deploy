import { useState } from "react";
import { KeyRound } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { toast } from "sonner";

interface ChangePasswordDialogProps {
  collapsed: boolean;
}

const ChangePasswordDialog = ({ collapsed }: ChangePasswordDialogProps) => {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmation("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmation) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }

    setIsSaving(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      toast.success("Contraseña actualizada");
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar la contraseña"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) reset(); }}>
      <DialogTrigger asChild>
        <SidebarMenuButton tooltip="Cambiar contraseña">
          <KeyRound className="h-4 w-4" />
          {!collapsed && <span>Cambiar contraseña</span>}
        </SidebarMenuButton>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>La nueva contraseña quedará guardada aunque la app se actualice.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Contraseña actual</Label>
            <Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input id="new-password" type="password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Repetir nueva contraseña</Label>
            <Input id="confirm-password" type="password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar contraseña"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
