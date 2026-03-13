import { supabase } from "@/integrations/supabase/client";

/**
 * Helper para acessar tabelas que existem no banco de dados mas não estão
 * nos tipos gerados automaticamente. Isso permite operações type-safe
 * em tabelas que foram criadas manualmente ou que estão em sync delay.
 */
export const supabaseUntyped = supabase as any;

/**
 * Acessa uma tabela específica do Supabase sem verificação de tipo.
 * Use apenas para tabelas que existem no banco mas não nos tipos gerados.
 * Retorna any para evitar conflitos de tipo.
 */
export function fromUntyped(tableName: string): any {
  return (supabase as any).from(tableName);
}

/**
 * Chama uma função RPC do Supabase sem verificação de tipo.
 * Use apenas para funções que existem no banco mas não nos tipos gerados.
 */
export function rpcUntyped(functionName: string, params?: Record<string, any>): any {
  return (supabase as any).rpc(functionName, params);
}
