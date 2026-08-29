import { Button } from "@/components/ui/button";
import { LogOut, TrendingUp, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Header = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.auth.logout();
    toast.success("Sesión cerrada");
    navigate("/auth");
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gradient">Dashboard Financiero</h1>
            <p className="text-xs text-muted-foreground">Gestión de Operaciones</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/expenses")}
            className="gap-2"
          >
            <Wallet className="h-4 w-4" />
            Egresos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
