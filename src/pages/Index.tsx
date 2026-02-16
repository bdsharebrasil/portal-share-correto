import { Layout } from "@/components/layout/Layout";
import { MainContent } from "@/components/dashboard/MainContent";
import DiarioBordo from "./DiarioBordo";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  // Mostrar Diário de Bordo por padrão na página inicial
  return (
    <Layout>
      <DiarioBordo onBack={() => navigate('/')} />
    </Layout>
  );
};

export default Index;
