// Tipos relacionados ao módulo core-finance
// Adicione suas interfaces aqui

export interface Transaction {
  id: string;
  amount: number;
  date: Date;
  description: string;
  category: string;
  type: 'income' | 'expense';
}

export interface Balance {
  totalIncome: number;
  totalExpense: number;
  net: number;
}