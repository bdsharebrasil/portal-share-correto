import { Check, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FormHeaderProps {
  currentStep: 1 | 2;
  onClose: () => void;
  onPrevious?: () => void;
  title: string;
}

export function FormHeader({
  currentStep,
  onClose,
  onPrevious,
  title,
}: FormHeaderProps) {
  return (
    <div className="space-y-4 pb-4 border-b">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        {/* Step 1 */}
        <div className="flex-1 flex items-center gap-2">
          <div
            className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold transition-all ${
              currentStep >= 1
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {currentStep > 1 ? <Check className="h-4 w-4" /> : '1'}
          </div>
          <span className={`text-xs font-medium ${
            currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'
          }`}>
            Dados do Voo
          </span>
        </div>

        {/* Divider */}
        <div className={`h-1 flex-1 rounded-full transition-all ${
          currentStep >= 2 ? 'bg-primary' : 'bg-muted'
        }`} />

        {/* Step 2 */}
        <div className="flex-1 flex items-center gap-2">
          <div
            className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold transition-all ${
              currentStep >= 2
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            2
          </div>
          <span className={`text-xs font-medium ${
            currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'
          }`}>
            Horas & Extras
          </span>
        </div>
      </div>

      {/* Navigation Buttons */}
      {currentStep > 1 && onPrevious && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrevious}
          className="w-full"
        >
          Voltar
        </Button>
      )}
    </div>
  );
}
