import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import BottomNavigation from "@/components/BottomNavigation";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import BinanceP2P from "./pages/BinanceP2P";
import Clients from "./pages/Clients";
import Expenses from "./pages/Expenses";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <SidebarProvider defaultOpen={false}>
                  <div className="flex min-h-screen w-full">
                    <div className="hidden md:flex">
                      <AppSidebar />
                    </div>
                    <main className="flex-1 pb-20 md:pb-0">
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/binance-p2p" element={<BinanceP2P />} />
                        <Route path="/clients" element={<Clients />} />
                        <Route path="/expenses" element={<Expenses />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </main>
                    <BottomNavigation />
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
