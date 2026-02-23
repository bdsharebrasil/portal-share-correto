// Re-export públicos do módulo ativos-aereos
export * from './pages';
export type * from './types';

// Hooks e Services viram export nomeado para melhor controle
export * as AtivoAereosHooks from './hooks';
export * as AtivoAereosServices from './services';