import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detectar se é iOS
    const checkIsIOS = () => {
      return /iPad|iPhone|iPod/.test(navigator.userAgent);
    };
    
    setIsIOS(checkIsIOS());

    // Handler para beforeinstallprompt (browsers que suportam)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Esconder o prompt se o app foi instalado
    window.addEventListener('appinstalled', () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  if (isIOS) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-blue-950 to-blue-900 border-t border-blue-800 p-4 shadow-lg">
        <div className="max-w-md mx-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-5 h-5 text-blue-300" />
                <h3 className="font-semibold text-white">Instale nosso app</h3>
              </div>
              <p className="text-sm text-blue-100 mb-3">
                Toque em <span className="font-semibold">Compartilhar</span> e selecione <span className="font-semibold">Adicionar à Tela de Início</span> para acesso rápido
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-blue-300 hover:text-white transition-colors flex-shrink-0 mt-1"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-950 to-blue-900 border-t border-blue-800 p-4 shadow-2xl">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-shrink-0 bg-white/10 p-3 rounded-lg">
              <Download className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Instale o app Share Brasil</h3>
              <p className="text-sm text-blue-100">Acesso rápido no seu desktop e mobilidade no celular</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleInstall}
              className="bg-blue-500 hover:bg-blue-600 text-white"
              size="sm"
            >
              Instalar
            </Button>
            <button
              onClick={handleDismiss}
              className="text-blue-300 hover:text-white transition-colors p-2"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
