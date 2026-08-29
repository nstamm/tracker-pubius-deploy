import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateExpenseDialog } from "@/components/Expenses/CreateExpenseDialog";
import { ExpensesTable } from "@/components/Expenses/ExpensesTable";
import { ExpensesFilters } from "@/components/Expenses/ExpensesFilters";
import { ExpensesChart } from "@/components/Expenses/ExpensesChart";

const Expenses = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedCategory, setSelectedCategory] = useState("Todas");

  const { data: expenses, refetch } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      return api.expenses.list();
    },
  });

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];

    let filtered = [...expenses];

    if (selectedMonth !== "all") {
      const monthNumber = parseInt(selectedMonth);
      filtered = filtered.filter((exp) => {
        const expMonth = Number(exp.fecha.slice(5, 7)) - 1;
        return expMonth === monthNumber;
      });
    }

    if (selectedCategory !== "Todas") {
      filtered = filtered.filter((exp) => exp.categoria === selectedCategory);
    }

    return filtered;
  }, [expenses, selectedMonth, selectedCategory]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-3 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
          <div>
            <h1 className="text-xl md:text-3xl font-bold">Gestión de Egresos</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Administra tus gastos y categorías
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} size="sm" className="md:h-10">
            <Plus className="h-4 w-4 mr-2" />
            <span className="md:inline">Nuevo Egreso</span>
          </Button>
        </div>

        <ExpensesFilters
          selectedMonth={selectedMonth}
          selectedCategory={selectedCategory}
          onMonthChange={setSelectedMonth}
          onCategoryChange={setSelectedCategory}
        />

        <ExpensesChart expenses={filteredExpenses} month={selectedMonth} />

        <ExpensesTable expenses={filteredExpenses} onUpdate={refetch} />

        <CreateExpenseDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSuccess={refetch}
        />
      </div>
    </div>
  );
};

export default Expenses;
