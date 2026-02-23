// Tipos relacionados ao módulo clientes
// Adicione suas interfaces aqui

export interface Cliente {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: 'PJ' | 'PF';
  status: 'ativo' | 'inativo';
  createdAt: Date;
}

export interface ClienteContact {
  id: string;
  clienteId: string;
  type: 'email' | 'phone' | 'address';
  value: string;
}