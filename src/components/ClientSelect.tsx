import { useState } from "react";
import { Check, ChevronsUpDown, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Client } from "@/lib/api";

interface ClientSelectProps {
  clients: Client[];
  value: string | null;
  onValueChange: (clientId: string | null) => void;
  className?: string;
}

const ClientSelect = ({ clients, value, onValueChange, className }: ClientSelectProps) => {
  const [open, setOpen] = useState(false);
  const selectedClient = clients.find((client) => client.id === value);

  const selectClient = (clientId: string | null) => {
    onValueChange(clientId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 w-full justify-between gap-2 border-border/80 bg-secondary/50 px-2 text-xs font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{selectedClient?.title ?? "Sin cliente"}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-60 p-0">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>No se encontraron clientees.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="sin cliente" onSelect={() => selectClient(null)}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                Sin cliente
              </CommandItem>
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={`${client.title} ${client.email ?? ""} ${client.phone ?? ""}`}
                  onSelect={() => selectClient(client.id)}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === client.id ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 truncate">{client.title}</span>
                  {client.email && <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{client.email}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ClientSelect;
