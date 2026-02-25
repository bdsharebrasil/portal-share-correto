import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center p-12 bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/50 max-w-md">
        <h1 className="text-8xl font-bold mb-6 text-cyan-400">404</h1>
        <p className="text-2xl text-slate-300 mb-8">Página não encontrada</p>
        <p className="text-base text-slate-400 mb-8">A página que você está procurando não existe ou foi removida.</p>
        <a 
          href="/" 
          className="inline-block px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors font-medium"
        >
          Voltar ao Início
        </a>
      </div>
    </div>
  );
};

export default NotFound;
