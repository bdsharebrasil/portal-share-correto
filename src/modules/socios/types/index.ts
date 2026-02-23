// Tipos relacionados ao módulo socios
// Adicione suas interfaces aqui

export interface Socio {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  status: 'ativo' | 'inativo';
  createdAt: Date;
}

export interface SocioTransacao {
  id: string;
  socioId: string;
  amount: number;
  date: Date;
  description: string;
  type: 'entrada' | 'saida';
}