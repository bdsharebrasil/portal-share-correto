import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      expand={false}
      richColors={false}
      closeButton={false}
      className="toaster group"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: `
            group toast 
            relative flex items-center w-full max-w-md p-4 
            bg-gradient-to-br from-card/95 to-card-secondary/95
            backdrop-blur-xl
            border border-white/10
            rounded-2xl
            shadow-2xl shadow-black/40
            animate-in slide-in-from-top-5 fade-in-0 duration-300
            data-[swipe=cancel]:translate-x-0
            data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]
            data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]
            data-[swipe=move]:transition-none
            data-[state=open]:animate-in
            data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0
            data-[state=closed]:slide-out-to-top-5
          `,
          description: "group-[.toast]:text-muted-foreground text-sm",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-medium rounded-lg px-3 py-1.5",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground font-medium rounded-lg px-3 py-1.5",
          success: "border-emerald-500/30",
          error: "border-red-500/30",
          warning: "border-amber-500/30",
          info: "border-blue-500/30",
        },
      }}
      {...props}
    />
  );
};

// Re-export toast from modern-toast for consistent API
export { Toaster };
export { toast } from "./modern-toast";
