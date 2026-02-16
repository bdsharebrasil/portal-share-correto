import DiarioBordo from "./DiarioBordo";

const Index = () => {
  // Mostrar Diário de Bordo por padrão na página inicial
  // DiarioBordo já inclui seu próprio Layout, não envolver em outro Layout
  // O botão "Voltar" do DiarioBordo navega para '/' (esta página)
  // Para evitar navegação recursiva, passamos uma função que não faz nada
  // ou poderíamos desabilitar o botão
  return <DiarioBordo onBack={() => {
    // Este callback é executado quando clica em "Voltar"
    // Como estamos na raiz, não navegamos para lugar nenhum
    // Você pode remover este comportamento ou rolar para topo
    window.scrollTo(0, 0);
  }} />;
};

export default Index;
