import { useState } from "react";
import { Check, ChevronsUpDown, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AccountHolder } from "@/lib/api";

interface AccountHolderSelectProps {
  accountHolders: AccountHolder[];
  value: string | null;
  onValueChange: (accountHolderId: string | null) => void;
  className?: string;
}

const AccountHolderSelect = ({ accountHolders, value, onValueChange, className }: AccountHolderSelectProps) => {
  const [open, setOpen] = useState(false);
  const selected = accountHolders.find((holder) => holder.id === value);
  const select = (id: string | null) => { onValueChange(id); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className={cn("h-8 w-full justify-between gap-2 border-border/80 bg-secondary/50 px-2 text-xs font-normal", className)}>
          <span className="flex min-w-0 items-center gap-1.5"><Landmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{selected ? `${selected.name} · ${selected.bank}` : "Sin titular de cuenta"}</span></span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-60 p-0">
        <Command>
          <CommandInput placeholder="Buscar titular de cuenta..." />
          <CommandList>
            <CommandEmpty>No se encontraron titulares de cuenta.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="sin titular de cuenta" onSelect={() => select(null)}><Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />Sin titular de cuenta</CommandItem>
              {accountHolders.map((holder) => <CommandItem key={holder.id} value={`${holder.name} ${holder.bank}`} onSelect={() => select(holder.id)}><Check className={cn("mr-2 h-4 w-4", value === holder.id ? "opacity-100" : "opacity-0")} /><span className="truncate">{holder.name}</span><span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{holder.bank}</span></CommandItem>)}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default AccountHolderSelect;
