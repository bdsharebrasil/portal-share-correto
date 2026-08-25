// @ts-nocheck
import { toast as sonnerToast } from "sonner";
import { Plane, X } from "lucide-react";

interface ToastOptions {
  duration?: number;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface LegacyToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

type AirplanePhase = "idle" | "flying" | "success" | "leaving";

function AirplaneToast({ phase, label, headline, body, onDone }: { phase: AirplanePhase; label: string; headline?: string; body?: string; onDone?: () => void }) {
  if (phase === "idle") return null;

  const title = headline || (phase === "success" ? "Operação concluída!" : "Processando...");
  const subtitle = body || (phase === "success" ? label : `Processando ${label}`);

  return (
    <div
      className={phase === "leaving" ? "toast-out" : "toast-in"}
      onAnimationEnd={phase === "leaving" ? onDone : undefined}
      style={{
        position: "fixed",
        bottom: 28,
        right: 28,
        zIndex: 9999,
        background: phase === "success"
          ? "linear-gradient(135deg,#052e16 0%,#064e3b 100%)"
          : "linear-gradient(135deg,#0a1628 0%,#162442 100%)",
        border: `1px solid ${phase === "success" ? "rgba(52,211,153,0.35)" : "rgba(59,111,160,0.5)"}`,
        borderRadius: 16,
        padding: "16px 20px",
        minWidth: 280,
        boxShadow: phase === "success"
          ? "0 16px 48px rgba(5,46,22,0.6), 0 0 0 1px rgba(52,211,153,0.15)"
          : "0 16px 48px rgba(8,15,28,0.7)",
        overflow: "hidden",
      }}
    >
      {phase === "success" && (
        <div style={{ position: "absolute", bottom: 0, left: 0, height: 3, background: "rgba(52,211,153,0.2)", width: "100%" }}>
          <div
            style={{ height: "100%", background: "#34d399", borderRadius: 2, animation: "bar-sweep 3s linear forwards" }}
          />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, position: "relative", flexShrink: 0 }}>
          {phase === "flying" && (
            <div
              className="plane-spinning"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(59,111,160,0.15)",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <ellipse cx="13" cy="13" rx="2.2" ry="9" fill="#7aaed8" />
                <path d="M13 10 L2 16 L5 17 L13 13.5 L21 17 L24 16 Z" fill="#5a8fc0" />
                <path d="M13 20 L7 23 L8.5 23.5 L13 21.5 L17.5 23.5 L19 23 Z" fill="#5a8fc0" />
                <ellipse cx="13" cy="5" rx="1.5" ry="2.2" fill="#a8c8e8" />
              </svg>
            </div>
          )}

          {phase === "success" && (
            <div
              className="check-pop"
              style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(52,211,153,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="44" height="44" viewBox="0 0 44 44">
                <circle
                  className="check-circle"
                  cx="22" cy="22" r="18"
                  stroke="#34d399"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="113"
                  strokeDashoffset="113"
                  strokeLinecap="round"
                />
                <path
                  className="check-path"
                  d="M13 22 L19.5 28.5 L31 16"
                  stroke="#34d399"
                  strokeWidth="2.5"
                  fill="none"
                  strokeDasharray="40"
                  strokeDashoffset="40"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {phase === "flying" && (
            <>
              <div className="font-sora" style={{ fontSize: 13, fontWeight: 700, color: "#dce8f5", marginBottom: 2 }}>
                {title}
              </div>
              <div style={{ fontSize: 11, color: "#6b8aaa", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "flex", gap: 3 }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: "#3b6fa0",
                        display: "inline-block",
                        animation: `pulse-live 1.2s ease ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </span>
                {subtitle}
              </div>
            </>
          )}
          {phase === "success" && (
            <>
              <div className="font-sora" style={{ fontSize: 13, fontWeight: 700, color: "#6ee7b7", marginBottom: 2 }}>
                {title}
              </div>
              <div style={{ fontSize: 11, color: "#a7f3d0" }}>
                {subtitle}
              </div>
            </>
          )}
        </div>

        {phase === "success" && (
          <div style={{ color: "rgba(52,211,153,0.3)", flexShrink: 0 }}>
            <Plane size={14} style={{ transform: "rotate(-25deg)" }} />
          </div>
        )}
      </div>
    </div>
  );
}

const normalizeToastCopy = (type: "success" | "error" | "warning" | "info" | "loading", rawTitle: string) => {
  const text = String(rawTitle || "Operação concluída").trim();

  if (type === "success") {
    return {
      phase: "success" as AirplanePhase,
      headline: "Operação concluída!",
      body: text,
    };
  }

  if (type === "error") {
    return {
      phase: "flying" as AirplanePhase,
      headline: "Não foi possível concluir",
      body: text,
    };
  }

  if (type === "warning") {
    return {
      phase: "flying" as AirplanePhase,
      headline: "Atenção",
      body: text,
    };
  }

  if (type === "loading") {
    return {
      phase: "flying" as AirplanePhase,
      headline: "Processando...",
      body: text,
    };
  }

  return {
    phase: "flying" as AirplanePhase,
    headline: "Informação",
    body: text,
  };
};

const showToast = (type: "success" | "error" | "warning" | "info" | "loading", title: string, options?: ToastOptions) => {
  const { phase, headline, body } = normalizeToastCopy(type, title);
  const duration = options?.duration ?? (type === "loading" ? Infinity : type === "error" ? 5000 : 4000);

  return sonnerToast.custom((id) => (
    <AirplaneToast
      phase={phase}
      label={body}
      headline={headline}
      body={body}
      onDone={() => sonnerToast.dismiss(id)}
    />
  ), { duration });
};

export const toast = Object.assign(
  function (props: LegacyToastProps) {
    const { title = "", description, variant, duration } = props;
    const type = variant === "destructive" ? "error" : "success";
    const labelText = title || description || "Operação concluída";
    const { phase, headline, body } = normalizeToastCopy(type, labelText);
    const id = sonnerToast.custom((toastId) => (
      <AirplaneToast
        phase={phase}
        label={body}
        headline={headline}
        body={body}
        onDone={() => sonnerToast.dismiss(toastId)}
      />
    ), { duration: duration ?? 4000 });

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
