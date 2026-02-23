import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { VencimentosSyncProvider } from "@/contexts/VencimentosSyncContext";
import { ExpirationAlertsProvider } from "@/contexts/ExpirationAlertsContext";
import { AnniversaryAlertsProvider } from "@/contexts/AnniversaryAlertsContext";
import { GlobalLoader } from "@/components/ui/global-loader";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

const AppProviders = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    import("@/lib/pdfWorkerConfig")
      .then(({ configurePDFWorker }) => {
        return configurePDFWorker();
      })
      .catch((err) => {
        console.warn(
          "Aviso: Não foi possível configurar o worker de PDF. Será carregado do CDN.",
          err
        );
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LoadingProvider>
          <ViewModeProvider>
            <VencimentosSyncProvider>
              <ExpirationAlertsProvider>
                <AnniversaryAlertsProvider>
                  <TooltipProvider>
                    <Toaster />
                    <GlobalLoader />
                    <InstallPrompt />
                    {children}
                  </TooltipProvider>
                </AnniversaryAlertsProvider>
              </ExpirationAlertsProvider>
            </VencimentosSyncProvider>
          </ViewModeProvider>
        </LoadingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default AppProviders;
