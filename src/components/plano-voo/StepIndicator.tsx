import { Check, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  title: string;
  icon: LucideIcon;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="relative">
      {/* Progress Line */}
      <div className="absolute top-6 left-0 w-full h-0.5 bg-slate-700">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="relative flex justify-between">
        {steps.map((step) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex flex-col items-center">
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 relative z-10",
                  isCompleted
                    ? "bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30"
                    : isCurrent
                    ? "bg-gradient-to-br from-cyan-600 to-blue-700 ring-4 ring-cyan-500/30 shadow-lg shadow-cyan-500/40"
                    : "bg-slate-800 border-2 border-slate-600"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5 text-white" />
                ) : (
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      isCurrent ? "text-white" : "text-slate-400"
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-sm font-medium hidden md:block",
                  isCompleted || isCurrent ? "text-cyan-400" : "text-slate-500"
                )}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
