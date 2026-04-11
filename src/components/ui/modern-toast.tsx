// @ts-nocheck
import { toast as sonnerToast } from "sonner";
import { CheckCircle, XCircle, AlertCircle, Info, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastOptions {
  duration?: number;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Legacy shadcn toast interface for backwards compatibility
interface LegacyToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

// Custom toast component for different types
const ToastContent = ({
  type,
  title,
  description,
  onDismiss,
}: {
  type: "success" | "error" | "warning" | "info" | "loading";
  title: string;
  description?: string;
  onDismiss?: () => void;
}) => {
  const configs = {
    success: {
      icon: CheckCircle,
      gradient: "from-emerald-500 to-green-600",
      iconColor: "text-white",
    },
    error: {
      icon: XCircle,
      gradient: "from-red-500 to-rose-600",
      iconColor: "text-white",
    },
    warning: {
      icon: AlertCircle,
      gradient: "from-amber-500 to-orange-600",
      iconColor: "text-white",
    },
    info: {
      icon: Info,
      gradient: "from-blue-500 to-indigo-600",
      iconColor: "text-white",
    },
    loading: {
      icon: Loader2,
      gradient: "from-cyan-500 to-blue-600",
      iconColor: "text-white animate-spin",
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className="relative flex items-start gap-3 w-full">
      {/* Icon with gradient background */}
      <div
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
          "bg-gradient-to-br shadow-lg",
          config.gradient
        )}
      >
        <Icon className={cn("w-5 h-5", config.iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-foreground leading-tight">
          {title}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors -mt-0.5 -mr-1"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
};

// Helper to show toast with custom content
const showToast = (
  type: "success" | "error" | "warning" | "info" | "loading",
  title: string,
  options?: ToastOptions
) => {
  return sonnerToast.custom(
    (id) => (
      <ToastContent
        type={type}
        title={title}
        description={options?.descricao}
        onDismiss={() => sonnerToast.dismiss(id)}
      />
    ),
    {
      duration: options?.duration ?? (type === "loading" ? Infinity : type === "error" ? 5000 : 4000),
    }
  );
};

// Main toast object with methods
export const toast = Object.assign(
  // Callable function for legacy shadcn pattern: toast({ title, description, variant })
  function (props: LegacyToastProps) {
    const { title = "", description, variant, duration } = props;
    const type = variant === "destructive" ? "error" : "success";
    
    const id = sonnerToast.custom(
      (toastId) => (
        <ToastContent
          type={type}
          title={title}
          description={description}
          onDismiss={() => sonnerToast.dismiss(toastId)}
        />
      ),
      {
        duration: duration ?? 4000,
      }
    );

    return {
      id: String(id),
      dismiss: () => sonnerToast.dismiss(id),
      update: () => {},
    };
  },
  {
    success: (title: string, options?: ToastOptions) => showToast("success", title, options),
    error: (title: string, options?: ToastOptions) => showToast("error", title, options),
    warning: (title: string, options?: ToastOptions) => showToast("warning", title, options),
    info: (title: string, options?: ToastOptions) => showToast("info", title, options),
    loading: (title: string, options?: ToastOptions) => showToast("loading", title, options),
    message: (title: string, options?: ToastOptions) => showToast("info", title, options),
    
    promise: <T,>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: any) => string);
      }
    ) => {
      return sonnerToast.promise(promise, {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      });
    },

    dismiss: (id?: string | number) => {
      sonnerToast.dismiss(id);
    },
  }
);

export default toast;
