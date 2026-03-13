// Re-export from modern toast for backwards compatibility
import { toast } from "@/components/ui/modern-toast";

// Wrapper hook for components that use useToast pattern
function useToast() {
  return {
    toast,
    dismiss: toast.dismiss,
    toasts: [] as any[], // Legacy compat - not used with sonner
  };
}

export { useToast, toast };
