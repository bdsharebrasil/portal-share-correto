import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      expand={false}
      richColors={false}
      closeButton={false}
      className="toaster group"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "!bg-transparent !border-0 !shadow-none !p-0 !rounded-none",
          description: "opacity-0",
          actionButton: "hidden",
          cancelButton: "hidden",
        },
      }}
      {...props}
    />
  );
};

// Re-export toast from modern-toast for consistent API
export { Toaster };
export { toast } from "./modern-toast";
