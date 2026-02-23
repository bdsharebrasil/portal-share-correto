// Re-export públicos do módulo core-finance
export * from './pages';
export type * from './types';

// Hooks e Services viram export nomeado para melhor controle
export * as CoreFinanceHooks from './hooks';
export * as CoreFinanceServices from './services';