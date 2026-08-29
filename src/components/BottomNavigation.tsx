import { DollarSign, Wallet } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const BottomNavigation = () => {

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <div className="flex items-center justify-around h-16 px-4">
        <NavLink
          to="/expenses"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <Wallet className="h-5 w-5" />
          <span className="text-xs font-medium">Egresos</span>
        </NavLink>
        
        <NavLink
          to="/"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <DollarSign className="h-5 w-5" />
          <span className="text-xs font-medium">Operaciones</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default BottomNavigation;
