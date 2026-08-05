import { supabase } from "@/integrations/supabase/client";

export interface EmailJaEnviadoInfo {
  destinatario: string;
  assunto: string | null;
  criado_em: string;
}

/**
 * Verifica se já existe um envio bem-sucedido em `emails_enviados`
 * para o mesmo destinatário (e mesmo documento, quando informado).
 */
export async function verificarEmailJaEnviado(params: {
  destinatario: string;
  referenceIds?: string[];
  referenceType?: string;
  assunto?: string;
}): Promise<EmailJaEnviadoInfo | null> {
  const destinatario = (params.destinatario || "").trim().toLowerCase();
  if (!destinatario) return null;

  try {
    let q = (supabase as any)
      .from("emails_enviados")
      .select("destinatario, assunto, criado_em, status")
      .eq("status", "enviado")
      .ilike("destinatario", destinatario)
      .order("criado_em", { ascending: false })
      .limit(1);

    const ids = (params.referenceIds || []).map(String).filter(Boolean);
    if (ids.length > 0) q = q.in("reference_id", ids);
    if (params.referenceType) q = q.eq("reference_type", params.referenceType);
    if (ids.length === 0 && params.assunto?.trim()) q = q.eq("assunto", params.assunto.trim());

    const { data } = await q;
    const row = (data || [])[0];
    return row ? { destinatario: row.destinatario, assunto: row.assunto, criado_em: row.criado_em } : null;
  } catch {
    return null;
  }
}