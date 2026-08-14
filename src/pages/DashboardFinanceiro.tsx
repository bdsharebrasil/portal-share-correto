import { useEffect } from "react";
import { useEffect } from "react";
import { useViewMode } from "@/contexts/ViewModeContext";
import { Layout } from "@/components/layout/Layout";
import { MainContent } from "@/components/dashboard/MainContent";

const DashboardFinanceiro = () => {
  const { setViewMode } = useViewMode();

  useEffect(() => {
    setViewMode("financeiro");
  }, [setViewMode]);

  return (
    <Layout>
      <MainContent />
    </Layout>
  );
};

export default DashboardFinanceiro;
