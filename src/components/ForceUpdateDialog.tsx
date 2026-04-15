import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ForceUpdateDialogProps {
  open: boolean;
  storeUrl: string;
}

export function ForceUpdateDialog({ open, storeUrl }: ForceUpdateDialogProps) {
  const handleUpdate = () => {
    window.open(storeUrl, "_system");
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" />
            Mise à jour requise
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-2">
            Une nouvelle version de l'application est disponible. Veuillez mettre
            à jour pour continuer à utiliser Flipz.
          </DialogDescription>
        </DialogHeader>
        <Button onClick={handleUpdate} className="w-full mt-4">
          Mettre à jour
        </Button>
      </DialogContent>
    </Dialog>
  );
}
