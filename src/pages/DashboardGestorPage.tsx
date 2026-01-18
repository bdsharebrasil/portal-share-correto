import { useEffect } from "react";
import { useViewMode } from "@/contexts/ViewModeContext";
import { Layout } from "@/components/layout/Layout";
import { MainContent } from "@/components/dashboard/MainContent";

const DashboardGestorPage = () => {
  const { setViewMode } = useViewMode();

  useEffect(() => {
    setViewMode("gestor");
  }, [setViewMode]);

  return (
    <Layout>
      <MainContent />
    </Layout>
  );
};

export default DashboardGestorPage;
