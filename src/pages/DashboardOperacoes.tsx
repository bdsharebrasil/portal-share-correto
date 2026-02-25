import { useEffect } from "react";
import { useViewMode } from "@/contexts/ViewModeContext";
import { Layout } from "@/components/layout/Layout";
import { MainContent } from "@/components/dashboard/MainContent";

const DashboardOperacoes = () => {
  const { setViewMode } = useViewMode();

  useEffect(() => {
    setViewMode("operacoes");
  }, [setViewMode]);

  return (
    <Layout>
      <MainContent />
    </Layout>
  );
};

export default DashboardOperacoes;
