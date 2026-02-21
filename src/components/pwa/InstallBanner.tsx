
import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePWA } from '@/hooks/usePWA';

export function InstallBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const { isInstallable, installApp } = usePWA();

  if (!isInstallable || !isVisible) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-none shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Download className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Instalar Share Brasil</h3>
              <p className="text-sm text-blue-100">
                Acesse offline e receba notificações
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={installApp}
              variant="secondary"
              size="sm"
              className="bg-white text-blue-600 hover:bg-blue-50"
            >
              Instalar
            </Button>
            <Button
              onClick={() => setIsVisible(false)}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
