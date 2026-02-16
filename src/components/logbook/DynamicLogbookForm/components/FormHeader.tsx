// components/FormHeader.tsx
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plane, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormHeaderProps {
  step: 1 | 2;
  saved: boolean;
}

export function FormHeader({ step, saved }: FormHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-primary/20 to-primary/5 px-6 py-4 border-b border-border/50">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl">
          <Plane className="h-5 w-5 text-primary" />
          Novo Trecho de Voo
        </DialogTitle>
      </DialogHeader>

      {/* Progress indicator */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {step > 1 ? <Check className="h-4 w-4" /> : "1"}
            </div>
            <span className="text-sm font-medium">Dados do Voo</span>
          </div>
          <div className="h-px flex-1 mx-4 bg-border" />
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              2
            </div>
            <span className="text-sm font-medium">Tempos e Extras</span>
          </div>
        </div>
      </div>

      {/* Saved overlay */}
      {saved && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-background/80 backdrop-blur-sm">
          <div className="bg-success/20 rounded-full p-6 shadow-lg flex items-center justify-center animate-in zoom-in-50">
            <div className="h-16 w-16 rounded-full bg-success text-success-foreground flex items-center justify-center">
              <Check className="h-8 w-8" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}