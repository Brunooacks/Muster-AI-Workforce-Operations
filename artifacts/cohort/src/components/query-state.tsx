import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertOctagon, RotateCw } from "lucide-react";

export function ErrorState({
  title = "Não foi possível carregar os dados",
  description = "Ocorreu um erro ao falar com o servidor. Verifique a conexão e tente novamente.",
  onRetry,
  compact = false,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <Card
      className={`flex flex-col items-center justify-center gap-3 border-destructive/20 bg-destructive/5 text-center ${
        compact ? "p-6" : "p-10"
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
        <AlertOctagon className="h-5 w-5 text-destructive" />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="mr-2 h-4 w-4" /> Tentar novamente
        </Button>
      )}
    </Card>
  );
}
