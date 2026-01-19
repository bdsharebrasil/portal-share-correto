import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function FornecedorFavoritoConfig({ onSave, fornecedor }: { onSave: (data: any) => void, fornecedor?: any }) {
  const [nomeCompleto, setNomeCompleto] = useState(fornecedor?.nome_completo || "");
  const [cidade, setCidade] = useState(fornecedor?.cidade || "");
  const [telefone, setTelefone] = useState(fornecedor?.telefone || "");
  const [documento, setDocumento] = useState(fornecedor?.documento || "");
  const [categoria, setCategoria] = useState(fornecedor?.categoria || "");
  const [apelido, setApelido] = useState(fornecedor?.apelido || "");

  // Adicione campos para edição
  const [id] = useState(fornecedor?.id || null);
  const [criadoPor] = useState(fornecedor?.criado_por || "");
  const [criadoEm] = useState(fornecedor?.criado_em || "");
  const [atualizadoEm, setAtualizadoEm] = useState(fornecedor?.atualizado_em || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let data, error;
      if (id) {
        // Atualizar fornecedor existente
        ({ data, error } = await supabase
          .from('fornecedores_favoritos')
          .update({
            nome_completo: nomeCompleto,
            cidade,
            telefone,
            documento,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', id)
          .select());
      } else {
        // Criar novo fornecedor
        ({ data, error } = await supabase
          .from('fornecedores_favoritos')
          .insert([{
            nome_completo: nomeCompleto,
            cidade,
            telefone,
            documento,
          }])
          .select());
      }

      if (error) throw error;

      toast.success('Fornecedor favorito salvo com sucesso');
      onSave(data[0]);
    } catch (error) {
      console.error('Erro ao salvar fornecedor favorito:', error);
      toast.error('Erro ao salvar fornecedor favorito');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
        <input
          value={nomeCompleto}
          onChange={e => setNomeCompleto(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Cidade</label>
        <input
          value={cidade}
          onChange={e => setCidade(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Telefone</label>
        <input
          value={telefone}
          onChange={e => setTelefone(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Documento</label>
        <input
          value={documento}
          onChange={e => setDocumento(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Categoria</label>
        <select
          value={categoria}
          onChange={e => setCategoria(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/50"
        >
          <option value="">Nenhuma</option>
          <option value="particular">Particular</option>
          <option value="share">Share</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Apelido</label>
        <input
          value={apelido}
          onChange={e => setApelido(e.target.value)}
          placeholder="Ex: Posto BR"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/50"
        />
      </div>
      {id && (
        <>
          <div>
            <label className="block text-xs text-gray-500">ID</label>
            <input value={id} disabled className="mt-1 block w-full rounded-md border-gray-200 bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Criado por</label>
            <input value={criadoPor} disabled className="mt-1 block w-full rounded-md border-gray-200 bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Criado em</label>
            <input value={criadoEm} disabled className="mt-1 block w-full rounded-md border-gray-200 bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Atualizado em</label>
            <input value={atualizadoEm} disabled className="mt-1 block w-full rounded-md border-gray-200 bg-gray-100" />
          </div>
        </>
      )}
      <button
        type="submit"
        className="w-full inline-flex justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        Salvar
      </button>
    </form>
  );
}