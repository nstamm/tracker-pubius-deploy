import { Download, PlusSquare, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const InstallGuide = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="outline" className="h-9 gap-2 border-border/80 bg-background/50">
        <Download className="h-4 w-4" />
        Instalar app
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Instalá PUBIUS</DialogTitle>
        <DialogDescription>Accedé al tracker como una app desde la pantalla de inicio.</DialogDescription>
      </DialogHeader>
      <div className="space-y-5 text-sm">
        <section className="rounded-lg border border-border/70 bg-secondary/40 p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <Share className="h-4 w-4 text-primary" />
            iPhone
          </div>
          <ol className="space-y-2 text-muted-foreground">
            <li>1. Abrí esta página en Safari.</li>
            <li>2. Tocá Compartir.</li>
            <li>3. Elegí Agregar a pantalla de inicio y confirmá Agregar.</li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">Safari es la opción recomendada en iPhone; no hace falta usar Chrome.</p>
        </section>
        <section className="rounded-lg border border-border/70 p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <PlusSquare className="h-4 w-4 text-primary" />
            Android o escritorio
          </div>
          <p className="text-muted-foreground">En Chrome, abrí el menú y elegí Instalar Pubius o Agregar a pantalla de inicio.</p>
        </section>
      </div>
    </DialogContent>
  </Dialog>
);

export default InstallGuide;
