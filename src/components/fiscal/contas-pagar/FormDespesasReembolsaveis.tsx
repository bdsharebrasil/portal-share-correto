import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { FornecedorSelect } from "./FornecedorSelect";
import { ValorVencimentoFields, BoletoSection, NFSection, ObservacaoField } from "./SharedFormFields";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (form.client_id) loadPartners(form.client_id);
    else setPartners([]);
  }, [form.client_id]);

  const loadClients = async () => {
    const { data } = await supabase.from("clients").select("id, company_name, proprietario, has_partner").order("company_name");
    setClients(data || []);
  };

  const loadPartners = async (clientId: string) => {
    const { data } = await supabase.from("client_partners").select("id, name, cpf").eq("client_id", clientId);
    setPartners(data || []);
  };

  const selectedClient = clients.find(c => c.id === form.client_id);
  const isDeceaInfraero = form.fornecedor_nome?.toUpperCase()?.includes("DECEA") || form.fornecedor_nome?.toUpperCase()?.includes("INFRAERO");

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Despesas Reembolsáveis</h3>

      {/* Cliente */}
      <div>
        <label className="text-sm font-semibold mb-1 block">Cliente *</label>
        <AutocompleteInput
          value={selectedClient?.company_name || ""}
          onChange={(val) => {
            const client = clients.find(c => c.company_name === val);
            setForm({ ...form, client_id: client?.id || null, client_partner_id: null });
          }}
          onSelect={(opt) => {
            const client = clients.find(c => c.id === opt.id);
            setForm({ ...form, client_id: client?.id || null, client_partner_id: null });
          }}
          options={clients.map(c => ({ id: c.id, label: c.company_name || c.proprietario || "Sem nome" }))}
          placeholder="Buscar cliente..."
        />
      </div>

      {/* Partners */}
      {selectedClient?.has_partner && partners.length > 0 && (
        <div>
          <label className="text-sm font-semibold mb-1 block">Sócio</label>
          <RegularSelect value={form.client_partner_id || ""} onValueChange={v => setForm({ ...form, client_partner_id: v })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o sócio..." /></SelectTrigger>
            <SelectContent>
              {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name} - {p.cpf}</SelectItem>)}
            </SelectContent>
          </RegularSelect>
        </div>
      )}

      {/* Aeronave */}
      <div>
        <label className="text-sm font-semibold mb-1 block">Aeronave *</label>
        <AutocompleteInput
          value={form.aeronave_registro || ""}
          onChange={(val) => {
            const aero = aeronaves.find((a: any) => a.registration === val);
            setForm({ ...form, aeronave_id: aero?.id || null, aeronave_registro: val });
          }}
          onSelect={(opt) => {
            const aero = aeronaves.find((a: any) => a.id === opt.id);
            setForm({ ...form, aeronave_id: aero?.id || null, aeronave_registro: aero?.registration || "" });
          }}
          options={aeronaves.map((a: any) => ({ id: a.id, label: `${a.registration} - ${a.model}` }))}
          placeholder="Buscar aeronave..."
        />
      </div>

      <FornecedorSelect
        fornecedores={fornecedores}
        categoriaFilter="share"
        value={form.fornecedor_favorito_id}
        onChange={(nome, forn) => {
          setForm({
            ...form,
            fornecedor_nome: nome,
            fornecedor_favorito_id: forn?.id || null,
            fornecedor_cnpj: forn?.documento || "",
            conta_pagamento_fornecedor: forn?.conta_pagamento || ""
          });
        }}
        contaPagamento={form.conta_pagamento_fornecedor}
        onFornecedorAdded={onReloadFornecedores}
      />

      <ValorVencimentoFields form={form} setForm={setForm} />

      {/* DECEA/Infraero */}
      {isDeceaInfraero && (
        <div className="space-y-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <p className="text-xs font-semibold text-amber-600 uppercase">Campos DECEA / Infraero</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Número do Documento</label>
              <Input value={form.numero_documento_decea || ""} onChange={e => setForm({ ...form, numero_documento_decea: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Competência</label>
              <Input value={form.competencia_decea || ""} onChange={e => setForm({ ...form, competencia_decea: e.target.value })} placeholder="MM/AAAA" className="h-9 text-sm" />
            </div>
          </div>
        </div>
      )}

      <BoletoSection form={form} setForm={setForm} />
      <NFSection form={form} setForm={setForm} />
      <ObservacaoField form={form} setForm={setForm} />
    </div>
  );
}
