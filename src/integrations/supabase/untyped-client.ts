/**
 * Wrapper não-tipado do cliente Supabase.
 *
 * O arquivo `client.ts` é gerado automaticamente e reaplica `Database` a cada
 * sincronização de schema, o que quebra o build sempre que o schema do banco
 * diverge dos types gerados (views/tabelas renomeadas EN <-> PT).
 *
 * O alias `@/integrations/supabase/client` aponta para este arquivo via
 * `paths` no tsconfig, então todos os imports existentes continuam válidos
 * e recebem um cliente sem checagem estrutural de tabelas/colunas.
 */
import { supabase as generatedClient } from "./client";

export const supabase: any = generatedClient as any;

export default supabase;
