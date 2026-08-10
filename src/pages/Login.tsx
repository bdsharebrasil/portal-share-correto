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
import { Lock, User, Plane, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { InlineLottieSpinner } from "@/components/ui/inline-lottie-spinner";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, isLoading: authLoading, refreshRoles } = useAuth();
  const { setViewMode } = useViewMode();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberUser, setRememberUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);

  useEffect(() => {
    if (!authLoading && session) {
      navigate("/", { replace: true });
    }
  }, [authLoading, navigate, session]);

  useEffect(() => {
    const savedUser = localStorage.getItem("login_username");
    if (savedUser) {
      setUsername(savedUser);
      setRememberUser(true);
    }
  }, []);

  const isUsernameValid = () => {
    const trimmed = username.trim();
    return trimmed.length > 0 && !trimmed.includes(" ") && !trimmed.includes("@");
  };

  const handleUsernameChange = (value: string) => {
    const sanitized = value.replace(/[@\s]/g, "").trim().toLowerCase();
    setUsername(sanitized);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!username || !password) {
      toast({ title: "Campos obrigatórios", description: "Por favor, preencha seu usuário e senha.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formattedEmail = `${username}@share-brasil.com`;
      if (rememberUser) localStorage.setItem("login_username", username);
      else localStorage.removeItem("login_username");

      const { error } = await supabase.auth.signInWithPassword({ email: formattedEmail, password });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const loadedRoles = await refreshRoles(user.id);
        if (loadedRoles && loadedRoles.length > 0) {
          const { route, viewMode } = getDashboardRouteFromRoles(loadedRoles);
          setViewMode(viewMode);
          navigate(route, { replace: true });
          return;
        }
      }
      toast({ title: "Acesso autorizado", description: "Bem-vindo(a) ao portal." });
    } catch (error) {
      let description = "Não foi possível realizar o login.";
      if (error instanceof Error) {
        if (error.message.toLowerCase().includes("invalid") || error.message.toLowerCase().includes("credentials")) {
          description = "Usuário ou senha incorretos. Tente novamente.";
        } else {
          description = error.message;
        }
      }
      toast({ title: "Acesso negado", description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasInput = username.length > 0;
  const isValid = hasInput && isUsernameValid();
  const showSuccessIcon = isValid && !isUsernameFocused;

  // UX: Rotas intercontinentais (Ponto A -> Ponto B)
  // Cada avião possui origem (sx, sy), destino (ex, ey), ângulo direcional e opacidade
  const routes = [
    { sx: "-40vw", sy: "-20vh", ex: "10vw", ey: "30vh", angle: "135deg", size: 24, op: 0.25, dur: "18s", delay: "0s" },
    { sx: "30vw", sy: "40vh", ex: "-30vw", ey: "-10vh", angle: "-45deg", size: 16, op: 0.15, dur: "25s", delay: "3s" },
    { sx: "-20vw", sy: "40vh", ex: "40vw", ey: "-20vh", angle: "-45deg", size: 20, op: 0.2, dur: "22s", delay: "7s" },
    { sx: "40vw", sy: "-30vh", ex: "-10vw", ey: "40vh", angle: "140deg", size: 18, op: 0.2, dur: "20s", delay: "12s" },
    { sx: "-35vw", sy: "10vh", ex: "35vw", ey: "15vh", angle: "90deg", size: 28, op: 0.3, dur: "28s", delay: "2s" },
    { sx: "25vw", sy: "-40vh", ex: "-25vw", ey: "-35vh", angle: "-90deg", size: 14, op: 0.15, dur: "35s", delay: "9s" },
    { sx: "10vw", sy: "40vh", ex: "-40vw", ey: "-30vh", angle: "-50deg", size: 22, op: 0.25, dur: "24s", delay: "15s" },
    { sx: "-40vw", sy: "-30vh", ex: "40vw", ey: "30vh", angle: "125deg", size: 16, op: 0.15, dur: "30s", delay: "5s" },
  ];

  return (
    <>
      <InstallPrompt />
      
      {/* Engine de Animação A->B com Fade-in/Fade-out */}
      <style>{`
        @keyframes flight-path {
          0% { 
            transform: translate(var(--sx), var(--sy)) rotate(var(--angle)) scale(0.8); 
            opacity: 0; 
          }
          15% { 
            opacity: var(--op); 
            transform: translate(calc(var(--sx) + (var(--ex) - var(--sx)) * 0.15), calc(var(--sy) + (var(--ey) - var(--sy)) * 0.15)) rotate(var(--angle)) scale(1);
          }
          85% { 
            opacity: var(--op); 
            transform: translate(calc(var(--sx) + (var(--ex) - var(--sx)) * 0.85), calc(var(--sy) + (var(--ey) - var(--sy)) * 0.85)) rotate(var(--angle)) scale(1);
          }
          100% { 
            transform: translate(var(--ex), var(--ey)) rotate(var(--angle)) scale(0.8); 
            opacity: 0; 
          }
        }
        .animate-flight {
          animation: flight-path var(--dur) linear infinite;
          animation-delay: var(--delay);
        }
      `}</style>

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030814] text-white">
        
        {/* Camada 1: Gradientes de Profundidade */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,_rgba(20,67,122,0.45),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(17,94,133,0.35),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(24,73,109,0.35),_transparent_45%)]" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-[#02050d]/95 via-[#061225]/85 to-[#081b31]/95" />

        {/* Camada 2: Mapa Múndi Holográfico (Vetor simples processado por CSS) */}
        <div 
          className="pointer-events-none absolute inset-0 z-0 opacity-20 mix-blend-screen bg-no-repeat bg-center"
          style={{
            backgroundImage: "url('https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg')",
            backgroundSize: "80% auto",
            filter: "invert(70%) sepia(100%) saturate(300%) hue-rotate(150deg) brightness(120%) drop-shadow(0 0 10px rgba(57,208,255,0.2))",
            maskImage: "radial-gradient(circle at center, black 30%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(circle at center, black 30%, transparent 80%)"
          }}
        />

        {/* Camada 3: Rede Global de Aviões */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          {routes.map((route, i) => (
            <div
              key={i}
              className="absolute animate-flight text-[#39d0ff]"
              style={{
                "--sx": route.sx,
                "--sy": route.sy,
                "--ex": route.ex,
                "--ey": route.ey,
                "--angle": route.angle,
                "--op": route.op,
                "--dur": route.dur,
                "--delay": route.delay,
              } as React.CSSProperties}
            >
              <Plane 
                style={{ height: `${route.size}px`, width: `${route.size}px` }} 
                className="drop-shadow-[0_0_12px_rgba(57,208,255,0.4)]" 
              />
            </div>
          ))}
        </div>
        
        {/* Camada 4: Card Principal do Login */}
        <div className="relative z-20 w-full max-w-md rounded-[32px] border border-white/10 bg-[#061223]/75 p-10 shadow-[0_40px_80px_-20px_rgba(0,10,20,0.85)] backdrop-blur-xl">
          
          <div className="flex flex-col items-center text-center">
            <img 
              src="https://cdn.builder.io/api/v1/image/assets%2Faf5a83f35004455bbe0a6d0781c48fda%2F51b9a2880aa1414ab466f8d29b17f07e?format=webp&width=800" 
              alt="Logo Share Brasil" 
              className="h-20 w-auto object-contain transition-transform duration-500 hover:scale-105" 
            />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#f8fafc]">Share Brasil</h1>
            <p className="mt-1.5 text-sm text-[#94a3b8]">Acesso ao Portal do Colaborador</p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            
            {/* Campo Credencial */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-[#cbd5e1] ml-1">
              LOGIN
              </Label>
              <div className="relative group">
                <User className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors duration-300 ${isUsernameFocused ? 'text-[#38d7ff]' : 'text-white/30'}`} />
                <Input 
                  id="username" 
                  type="text" 
                  value={username} 
                  onChange={event => handleUsernameChange(event.target.value)}
                  onFocus={() => setIsUsernameFocused(true)}
                  onBlur={() => setIsUsernameFocused(false)}
                  placeholder="seu.nome" 
                  autoComplete="username" 
                  disabled={isSubmitting} 
                  className="h-14 rounded-2xl border-white/10 bg-white/5 pl-12 pr-40 text-base text-white placeholder:text-white/20 transition-all focus-visible:border-[#38d7ff]/50 focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-[#38d7ff]/50" 
                />
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className={`text-sm font-medium transition-colors duration-300 ${isUsernameFocused || isValid ? 'text-white/60' : 'text-white/30'}`}>
                    @share-brasil.com
                  </span>
                  {showSuccessIcon && <CheckCircle2 className="h-4 w-4 text-[#38d7ff] animate-in zoom-in fade-in duration-300" />}
                </div>
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-[#cbd5e1] ml-1">
                Senha
              </Label>
              <div className="relative group">
                <Lock className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors duration-300 text-white/30 group-focus-within:text-[#38d7ff]`} />
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={event => setPassword(event.target.value)} 
                  placeholder="••••••••" 
                  autoComplete="current-password" 
                  disabled={isSubmitting} 
                  className="h-14 rounded-2xl border-white/10 bg-white/5 pl-12 pr-12 text-base text-white placeholder:text-white/20 transition-all focus-visible:border-[#38d7ff]/50 focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-[#38d7ff]/50 tracking-widest placeholder:tracking-normal" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  disabled={isSubmitting} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:text-[#38d7ff]" 
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Checkbox */}
            <div className="flex items-center gap-3 pt-2 pb-1 ml-1">
              <Checkbox 
                id="remember-user" 
                checked={rememberUser} 
                onCheckedChange={checked => setRememberUser(checked as boolean)} 
                disabled={isSubmitting} 
                className="h-5 w-5 rounded-md border-white/20 bg-white/5 data-[state=checked]:bg-[#38d7ff] data-[state=checked]:border-[#38d7ff] data-[state=checked]:text-[#02111f]" 
              />
              <Label htmlFor="remember-user" className="text-sm font-medium text-[#94a3b8] cursor-pointer hover:text-white transition-colors">
                Lembrar meu acesso
              </Label>
            </div>

            {/* Botão com Sombra Nítida */}
            <Button 
              type="submit" 
              disabled={isSubmitting || !isValid || !password} 
              className="mt-2 h-14 w-full rounded-2xl bg-[#38d7ff] text-base font-semibold text-[#02111f] shadow-[0_8px_16px_-10px_rgba(56,215,255,0.4)] transition-all duration-300 hover:bg-[#6be4ff] hover:shadow-[0_12px_24px_-10px_rgba(56,215,255,0.6)] focus-visible:ring-2 focus-visible:ring-[#38d7ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#061223] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-3">
                  <InlineLottieSpinner size="md" />
                  Autenticando...
                </span>
              ) : (
                "Acessar Plataforma"
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs font-medium text-[#64748b]">
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;