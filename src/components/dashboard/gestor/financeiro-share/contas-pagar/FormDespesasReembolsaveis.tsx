// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { FornecedorSelect } from "./FornecedorSelect";
import { ValorVencimentoFields, BoletoSection, NFSection, ObservacaoField } from "./SharedFormFields";
import { supabase } from "@/integrations/supabase/client";

// Categorias que você listou
const CATEGORIAS_REEMBOLSAVEIS = [
  "INFRAERO pago",
  "DECEA pago",
  "ATENDIMENTO EM JUINA",
  "ATENDIMENTO HANGAR",
  "COMBUSTÍVEL AERONAVE - pago",
  "HANGAR FIXO MENSAL",
  "RELATORIO DE DESPESA DE VIAGEM",
  "RESSARCIMENTOS PAGOS",
  "SEGURO CASCO - pago",
  "SEGURO RETA - pago",
  "TARIFA DE POUSO"
];

interface Props {
  form: any;
  setForm: (f: any) => void;
  fornecedores: any[];
  aeronaves: any[];
  onReloadFornecedores?: () => void;
}

export function FormDespesasReembolsaveis({ form, setForm, fornecedores, aeronaves, onReloadFornecedores }: Props) {
  const [clients, setClients] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);

  useEffect(() => { loadClients(); }, []);

  useEffect(() => {
    if (form.cliente_id) loadPartners(form.cliente_id);
    else setPartners([]);
  }, [form.cliente_id]);

  const loadClients = async () => {
    const { data } = await supabase.from("clientes").select("id, razao_social, proprietario, tem_socio").order("razao_social");
    setClients(data || []);
  };

  const loadPartners = async (clientId: string) => {
    const { data } = await supabase.from("socios").select("id, nome, cpf").eq("cliente_id", clientId);
    setPartners(data || []);
  };

  // Lógica para mostrar campos DECEA ou INFRAERO baseada na categoria
  const isDecea = form.categoria === "DECEA pago";
  const isInfraero = form.categoria === "INFRAERO pago";

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Despesas Reembolsáveis</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cliente */}
        <div className="space-y-1">
          <label className="text-xs font-bold mb-1 block">CLIENTE *</label>
          <AutocompleteInput
            value={clients.find(c => c.id === form.cliente_id)?.razao_social || ""}
            onChange={(v) => {}}
            onSelect={(opt) => setForm({ ...form, client_id: opt.id, client_partner_id: null })}
            options={clients.map(c => ({ id: c.id, label: c.razao_social || c.proprietario || "Sem nome" }))}
            placeholder="Buscar cliente..."
          />
        </div>

        {/* Aeronave */}
        <div className="space-y-1">
          <label className="text-xs font-bold mb-1 block">AERONAVE *</label>
          <AutocompleteInput
            value={form.aeronave_registro || ""}
            onChange={(v) => {}}
            onSelect={(opt) => setForm({ ...form, aeronave_registro: opt.label.split(' - ')[0] })}
            options={aeronaves.map((a: any) => ({ id: a.id, label: `${a.registration} - ${a.model}` }))}
            placeholder="Selecione o prefixo..."
          />
        </div>
      </div>

      {/* Seleção de Categoria Reembolsável */}
      <div className="space-y-1">
        <label className="text-xs font-bold mb-1 block">TIPO DE DESPESA (CATEGORIA) *</label>
        <RegularSelect value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Selecione a categoria específica..." />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS_REEMBOLSAVEIS.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </RegularSelect>
      </div>

      {/* Sócio (Se o cliente tiver) */}
      {partners.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs font-bold mb-1 block">SÓCIO / PARCEIRO</label>
          <RegularSelect value={form.socio_cliente_id_id || ""} onValueChange={v => setForm({ ...form, client_partner_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione o sócio..." /></SelectTrigger>
            <SelectContent>
              {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </RegularSelect>
        </div>
      )}

      <FornecedorSelect
        fornecedores={fornecedores}
        value={form.fornecedor_favorito_id}
        onChange={(nome, forn) => setForm({
          ...form,
          fornecedor_nome: nome,
          fornecedor_favorito_id: forn?.id || null,
          banco: forn?.conta_pagamento || form.banco
        })}
        onFornecedorAdded={onReloadFornecedores}
      />

      <ValorVencimentoFields form={form} setForm={setForm} />

      {/* Campos Dinâmicos DECEA */}
      {isDecea && (
        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-3">
          <p className="text-[10px] font-bold text-amber-600 uppercase">Detalhamento DECEA</p>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Nº Documento" value={form.numero_documento_decea} onChange={e => setForm({...form, numero_documento_decea: e.target.value})} />
            <Input placeholder="Competência (MM/AAAA)" value={form.competencia_decea} onChange={e => setForm({...form, competencia_decea: e.target.value})} />
          </div>
          <Input placeholder="URL do Documento DECEA" value={form.decea_url} onChange={e => setForm({...form, decea_url: e.target.value})} />
        </div>
      )}

      {/* Campos Dinâmicos INFRAERO */}
      {isInfraero && (
        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-3">
          <p className="text-[10px] font-bold text-blue-600 uppercase">Detalhamento INFRAERO</p>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Nº Documento" value={form.numero_documento_infraero} onChange={e => setForm({...form, numero_documento_infraero: e.target.value})} />
            <Input placeholder="Competência (MM/AAAA)" value={form.competencia_infraero} onChange={e => setForm({...form, competencia_infraero: e.target.value})} />
          </div>
          <Input placeholder="URL do Documento Infraero" value={form.infraero_url} onChange={e => setForm({...form, infraero_url: e.target.value})} />
        </div>
      )}

      <BoletoSection form={form} setForm={setForm} />
      <NFSection form={form} setForm={setForm} />
      <ObservacaoField form={form} setForm={setForm} />
    </div>
  );
}
