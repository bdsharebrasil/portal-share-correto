// Re-export públicos do módulo clientes
export * from './pages';
export type * from './types';

// Hooks e Services viram export nomeado para melhor controle
export * as ClientesHooks from './hooks';
export * as ClientesServices from './services';