import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useViewMode } from "@/contexts/ViewModeContext";
import { getDashboardRouteFromRoles } from "@/lib/dashboard-routing";
import { Lock, Mail, Plane, Eye, EyeOff, Receipt, Trash2, ShoppingCart } from "lucide-react";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { InlineLottieSpinner } from "@/components/ui/inline-lottie-spinner";
const Login = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    session,
    isLoading: authLoading,
    refreshRoles,
    roles
  } = useAuth();
  const {
    setViewMode
  } = useViewMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    if (!authLoading && session) {
      navigate("/", {
        replace: true
      });
    }
  }, [authLoading, navigate, session]);
  useEffect(() => {
    const savedEmail = localStorage.getItem("login_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);
  const isEmailValid = () => {
    const trimmedEmail = email.trim();
    // Verifica se tem pelo menos um caractere, sem espaços e sem @
    return trimmedEmail.length > 0 && !trimmedEmail.includes(" ") && !trimmedEmail.includes("@");
  };

  const handleEmailChange = (value: string) => {
    // Remove @ se o usuário tentar digitar
    const sanitized = value.replace(/@/g, "").trim();
    setEmail(sanitized);
  };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    if (!email.trim() || !password) {
      toast({
        title: "Preencha os campos",
        description: "Informe email e senha para continuar.",
        variant: "destructive"
      });
      return;
    }
    if (!isEmailValid()) {
      toast({
        title: "Email inválido",
        description: "Preencha seu nome de usuário antes de @share (exemplo: joao)",
        variant: "destructive"
      });
      return;
    }
    setIsSubmitting(true);
    try {
      // Formata o email com @share.com
      const formattedEmail = `${email.trim()}@share.com`;
      if (rememberEmail) {
        localStorage.setItem("login_email", email.trim());
      } else {
        localStorage.removeItem("login_email");
      }
      const {
        error
      } = await supabase.auth.signInWithPassword({
        email: formattedEmail,
        password
      });
      if (error) {
        throw error;
      }
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (user) {
        const loadedRoles = await refreshRoles(user.id);

        // Redireciona para o dashboard apropriado baseado na role
        if (loadedRoles && loadedRoles.length > 0) {
          const {
            route,
            viewMode
          } = getDashboardRouteFromRoles(loadedRoles);
          setViewMode(viewMode);
          navigate(route, {
            replace: true
          });
          return;
        }
      }
      toast({
        title: "Login realizado",
        description: "Bem-vindo novamente ao portal."
      });
    } catch (error) {
      let description = "Não foi possível realizar o login.";
      if (error instanceof Error) {
        // Verifica se é erro de credenciais inválidas
        if (error.message.toLowerCase().includes("invalid") || error.message.toLowerCase().includes("credentials")) {
          description = "Login inválido, verifique seus dados";
        } else {
          description = error.message;
        }
      }
      toast({
        title: "Erro no login",
        description,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return <>
      <InstallPrompt />
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030814] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(20,67,122,0.45),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(17,94,133,0.35),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(24,73,109,0.35),_transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#02050d]/95 via-[#061225]/90 to-[#081b31]/95" />

      <div className="pointer-events-none absolute -left-10 top-28 text-[#39d0ff]/40 animate-plane-left">
        <Plane className="h-24 w-24 drop-shadow-[0_0_25px_rgba(57,208,255,0.35)]" />
      </div>
      <div className="pointer-events-none absolute bottom-24 right-6 text-[#2ac6f4]/35 animate-plane-right">
        <Plane className="h-20 w-20 drop-shadow-[0_0_22px_rgba(42,198,244,0.3)]" />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 text-[#48d8ff]/28 animate-plane-pulse">
        <Plane className="h-16 w-16" />
      </div>
      <div className="pointer-events-none absolute -right-14 top-1/4 text-[#35c0ff]/32 animate-plane-left" style={{
        animationDelay: "0.5s"
      }}>
        <Plane className="h-20 w-20 drop-shadow-[0_0_20px_rgba(53,192,255,0.3)]" />
      </div>
      <div className="pointer-events-none absolute -left-12 bottom-1/4 text-[#2ac6f4]/30 animate-plane-right" style={{
        animationDelay: "1s"
      }}>
        <Plane className="h-18 w-18 drop-shadow-[0_0_18px_rgba(42,198,244,0.25)]" />
      </div>
      <div className="pointer-events-none absolute right-1/3 top-1/2 text-[#39d0ff]/35 animate-plane-pulse" style={{
        animationDelay: "1.5s"
      }}>
        <Plane className="h-20 w-20 drop-shadow-[0_0_20px_rgba(57,208,255,0.3)]" />
      </div>
      <div className="pointer-events-none absolute left-1/4 top-2/3 text-[#48d8ff]/30 animate-plane-left" style={{
        animationDelay: "0.8s"
      }}>
        <Plane className="h-16 w-16 drop-shadow-[0_0_18px_rgba(72,216,255,0.25)]" />
      </div>
      <div className="pointer-events-none absolute right-1/4 bottom-1/3 text-[#35c0ff]/28 animate-plane-right" style={{
        animationDelay: "1.2s"
      }}>
        <Plane className="h-18 w-18 drop-shadow-[0_0_16px_rgba(53,192,255,0.25)]" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-[32px] border border-white/6 bg-[#061223]/80 p-10 shadow-[0_32px_70px_-28px_rgba(8,23,45,0.9)] backdrop-blur-2xl">
        <div className="flex flex-col items-center text-center">
          <img src="https://cdn.builder.io/api/v1/image/assets%2Faf5a83f35004455bbe0a6d0781c48fda%2F51b9a2880aa1414ab466f8d29b17f07e?format=webp&width=800" alt="Share Brasil logo" className="h-24 w-auto" />
          <h1 className="mt-2 text-3xl font-semibold text-[#5dd5ff]">Share Brasil</h1>
          <p className="mt-1 text-sm text-white/60">Portal Colaborador</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email" className="text-sm font-medium text-white/70">
                Email
              </Label>
              {email.trim().length > 0 && isEmailValid() ? <span className="text-xs text-green-400/80">✓ Válido</span> : email.trim().length > 0 ? <span className="text-xs text-red-400/80">✗ Inválido</span> : null}
            </div>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <Input id="email" type="text" value={email} onChange={event => handleEmailChange(event.target.value)} placeholder="nome-usuario" autoComplete="off" disabled={isSubmitting} className={`h-12 rounded-2xl border-2 transition-all bg-white/5 pl-10 pr-28 text-base text-white placeholder:text-white/40 focus-visible:bg-white/10 focus-visible:ring-offset-0 ${email.trim().length > 0 ? isEmailValid() ? "border-green-400/50 focus-visible:border-green-400 focus-visible:ring-2 focus-visible:ring-green-400/50" : "border-red-400/50 focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-400/50" : "border-white/10 focus-visible:border-[#38d7ff] focus-visible:ring-2 focus-visible:ring-[#38d7ff]"}`} />
              <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${email.trim().length > 0 ? isEmailValid() ? "bg-green-400/20 text-green-400" : "bg-red-500/20 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-gray/10 text-[#2ad1ff] drop-shadow-[0_0_6px_rgba(42,209,255,0.5)]"}`}>
                @share
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1">
              ​ <span className="text-white/70 font-medium">​</span>                 (digite apenas o seu nome de usuário)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-white/70">
              Senha
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="Sua senha" autoComplete="current-password" disabled={isSubmitting} className="h-12 rounded-2xl border-transparent bg-white/5 pl-10 pr-10 text-base text-white placeholder:text-white/40 focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#38d7ff] focus-visible:ring-offset-0" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={isSubmitting} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="remember-email" checked={rememberEmail} onCheckedChange={checked => setRememberEmail(checked as boolean)} disabled={isSubmitting} className="border-white/30 bg-white/5" />
            <Label htmlFor="remember-email" className="text-sm font-medium text-white/70 cursor-pointer">
              Lembrar email
            </Label>
          </div>

          <Button type="submit" disabled={isSubmitting || !isEmailValid() || !password} className="h-12 w-full rounded-2xl bg-[#2ad1ff] text-base font-semibold text-[#02111f] shadow-[0_22px_45px_-18px_rgba(42,209,255,0.75)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#33d9ff] focus-visible:ring-2 focus-visible:ring-[#33d9ff] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
            {isSubmitting ? <span className="flex items-center justify-center gap-2">
                <InlineLottieSpinner size="md" />
                Entrando...
              </span> : !isEmailValid() || !password ? "Preencha os campos corretamente" : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-white/55">Bem-vindo de volta ao nosso sistema</p>
      </div>
    </div>
    </>;
}
export default Login;
