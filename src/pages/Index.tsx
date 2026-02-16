import DiarioBordo from "./DiarioBordo";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  // Mostrar Diário de Bordo por padrão na página inicial
  // DiarioBordo já inclui seu próprio Layout, não envolver em outro Layout
  return <DiarioBordo onBack={() => navigate('/')} />;
};

export default Index;
