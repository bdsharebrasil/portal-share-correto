import { supabase } from "@/integrations/supabase/client";

export type TrainingRole = "admin" | "gestor_master" | "user";

export type TrainingMeeting = {
  id: string;
  titulo: string;
  descricao: string;
  host_id: string;
  status: "agendada" | "em_andamento" | "encerrada";
  agendada_para: string | null;
  iniciada_em?: string | null;
  encerrada_em?: string | null;
  created_at: string;
};

export type TrainingParticipant = {
  id: string;
  reuniao_id: string;
  user_id: string;
  nome: string;
  entrou_em: string;
  saiu_em: string | null;
};

export async function obterPapelTreinamento(): Promise<{ role: TrainingRole; userId: string | null }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  if (!userId) return { role: "user", userId: null };
  const { data } = await (supabase as any).from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((row: any) => String(row.role).toLowerCase());
  if (roles.includes("admin")) return { role: "admin", userId };
  if (roles.includes("gestor_master")) return { role: "gestor_master", userId };
  return { role: "user", userId };
}

export async function listarReunioesTreinamento(): Promise<TrainingMeeting[]> {
  const { data, error } = await (supabase as any)
    .from("unk_treinamento_reunioes")
    .select("id, titulo, descricao, host_id, status, agendada_para, iniciada_em, encerrada_em, created_at")
    .order("agendada_para", { ascending: true, nullsFirst: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as TrainingMeeting[];
}

export async function obterReuniaoTreinamento(id: string): Promise<TrainingMeeting> {
  const { data, error } = await (supabase as any)
    .from("unk_treinamento_reunioes")
    .select("id, titulo, descricao, host_id, status, agendada_para, iniciada_em, encerrada_em, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Reunião não encontrada.");
  return data as TrainingMeeting;
}

export async function criarReuniaoTreinamento(input: { titulo: string; descricao: string; agendada_para: string | null }) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sessão expirada. Entre novamente no sistema.");
  const { role } = await obterPapelTreinamento();
  if (role !== "admin" && role !== "gestor_master") throw new Error("Somente admin e gestor master podem criar reuniões.");
  const { data, error } = await (supabase as any)
    .from("unk_treinamento_reunioes")
    .insert({ titulo: input.titulo.trim(), descricao: input.descricao.trim(), host_id: auth.user.id, status: "agendada", agendada_para: input.agendada_para })
    .select("id, titulo, descricao, host_id, status, agendada_para, iniciada_em, encerrada_em, created_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Não foi possível criar a reunião.");
  return data as TrainingMeeting;
}

export async function atualizarStatusReuniao(id: string, status: TrainingMeeting["status"]) {
  const patch = {
    status,
    ...(status === "em_andamento" ? { iniciada_em: new Date().toISOString() } : {}),
    ...(status === "encerrada" ? { encerrada_em: new Date().toISOString() } : {}),
  };
  const { error } = await (supabase as any).from("unk_treinamento_reunioes").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function registrarParticipanteTreinamento(id: string, nome: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sessão expirada.");
  const { data, error } = await (supabase as any)
    .from("unk_treinamento_participantes")
    .upsert({ reuniao_id: id, user_id: auth.user.id, nome: nome.trim(), saiu_em: null }, { onConflict: "reuniao_id,user_id" })
    .select("id, reuniao_id, user_id, nome, entrou_em, saiu_em")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Não foi possível entrar na reunião.");
  return data as TrainingParticipant;
}

export async function sairDaReuniaoTreinamento(id: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await (supabase as any).from("unk_treinamento_participantes").update({ saiu_em: new Date().toISOString() }).eq("reuniao_id", id).eq("user_id", auth.user.id);
  if (error) throw new Error(error.message);
}
