import { useState } from "react";
import { DollarSign, ArrowLeftRight, Wallet, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { api, getErrorMessage } from "@/lib/api";
import InstallGuide from "@/components/InstallGuide";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Operaciones",
    url: "/",
    icon: DollarSign,
  },
  {
    title: "Binance P2P",
    url: "/binance-p2p",
    icon: ArrowLeftRight,
  },
  {
    title: "Egresos",
    url: "/expenses",
    icon: Wallet,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await api.auth.logout();
      toast.success("Sesión cerrada");
      navigate("/auth", { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo cerrar la sesión"));
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center justify-end p-2">
          <SidebarTrigger />
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <InstallGuide sidebar collapsed={isCollapsed} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ChangePasswordDialog collapsed={isCollapsed} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Cerrar Sesión" onClick={handleLogout} disabled={isLoggingOut}>
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span>{isLoggingOut ? "Cerrando..." : "Cerrar Sesión"}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
