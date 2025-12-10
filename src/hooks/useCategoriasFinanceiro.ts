import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Função para gerar UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface CategoriaFinanceiro {
  id: string;
  nome: string;
  tipo: "receita" | "despesa";
  categoria?: string | null;
  descricao?: string;
  ativo?: boolean;
  cliente_id?: string | null;
  cliente_nome?: string | null;
}

export interface Conta {
  id: string;
  nome: string;
  numero_conta?: string;
  banco?: string;
  tipo_conta?: "corrente" | "poupanca" | "investimento";
  ativo?: boolean;
  saldo?: number;
  criado_por?: string;
}

export function useCategoriasFinanceiro() {
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<CategoriaFinanceiro[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCategorias = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("categorias_movimentacao")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) {
        console.error("Erro ao carregar categorias:", error);
        return;
      }

      const mapped = (data || []).map(cat => ({
        id: cat.id,
        nome: cat.nome,
        tipo: cat.tipo as "receita" | "despesa",
        categoria: cat.categoria || null,
        descricao: cat.descricao || undefined,
        ativo: cat.ativo ?? true,
        cliente_id: cat.cliente_id || null,
        cliente_nome: cat.cliente_nome || null
      }));

      setCategorias(mapped);
    } catch (error) {
      console.error("Erro ao carregar categorias:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategorias();
  }, [loadCategorias]);

  const addCategoria = useCallback(async (categoria: Omit<CategoriaFinanceiro, "id">) => {
    if (!user) {
      toast.error("Usuário não autenticado");
      return false;
    }

    try {
      const { error } = await supabase
        .from("categorias_movimentacao")
        .insert([{
          nome: categoria.nome,
          tipo: categoria.tipo,
          categoria: categoria.categoria || null,
          descricao: categoria.descricao || null,
          ativo: true,
          cliente_id: categoria.cliente_id || null,
          cliente_nome: categoria.cliente_nome || null,
          criado_por: user.id
        }]);

      if (error) {
        toast.error(`Erro ao criar categoria: ${error.message}`);
        return false;
      }

      await loadCategorias();
      return true;
    } catch (error: any) {
      toast.error(`Erro ao criar categoria: ${error.message}`);
      return false;
    }
  }, [user, loadCategorias]);

  const updateCategoria = useCallback(async (id: string, updates: Partial<CategoriaFinanceiro>) => {
    try {
      const updateData: any = {};

      if (updates.nome !== undefined) updateData.nome = updates.nome;
      if (updates.tipo !== undefined) updateData.tipo = updates.tipo;
      if (updates.categoria !== undefined) updateData.categoria = updates.categoria || null;
      if (updates.descricao !== undefined) updateData.descricao = updates.descricao || null;
      if (updates.cliente_id !== undefined) updateData.cliente_id = updates.cliente_id || null;
      if (updates.cliente_nome !== undefined) updateData.cliente_nome = updates.cliente_nome || null;

      const { error } = await supabase
        .from("categorias_movimentacao")
        .update(updateData)
        .eq("id", id);

      if (error) {
        toast.error(`Erro ao atualizar categoria: ${error.message}`);
        return false;
      }

      await loadCategorias();
      return true;
    } catch (error: any) {
      toast.error(`Erro ao atualizar categoria: ${error.message}`);
      return false;
    }
  }, [loadCategorias]);

  const deleteCategoria = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("categorias_movimentacao")
        .update({ ativo: false })
        .eq("id", id);

      if (error) {
        toast.error(`Erro ao excluir categoria: ${error.message}`);
        return false;
      }

      await loadCategorias();
      return true;
    } catch (error: any) {
      toast.error(`Erro ao excluir categoria: ${error.message}`);
      return false;
    }
  }, [loadCategorias]);

  const getCategoriasReceita = useCallback(() => {
    return categorias.filter(cat => cat.tipo === "receita");
  }, [categorias]);

  const getCategoriasDespesa = useCallback(() => {
    return categorias.filter(cat => cat.tipo === "despesa");
  }, [categorias]);

  const getCategoriaNomes = useCallback(() => {
    return categorias.map(cat => cat.nome);
  }, [categorias]);

  return {
    categorias,
    isLoading,
    addCategoria,
    updateCategoria,
    deleteCategoria,
    getCategoriasReceita,
    getCategoriasDespesa,
    getCategoriaNomes,
    refetch: loadCategorias
  };
}

export function useCategoriasConta() {
  const { user } = useAuth();
  const { categorias, isLoading: categoriasLoading } = useCategoriasFinanceiro();
  const [contas, setContas] = useState<Conta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadContas = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) {
        console.error("Erro ao carregar contas:", error);
        return;
      }

      const mapped = (data || []).map(conta => ({
        id: conta.id,
        nome: conta.nome,
        numero_conta: conta.numero_conta || undefined,
        banco: conta.banco || undefined,
        tipo_conta: conta.tipo_conta || "corrente",
        ativo: conta.ativo ?? true,
        saldo: conta.saldo || 0,
        criado_por: conta.criado_por
      }));

      setContas(mapped);
    } catch (error) {
      console.error("Erro ao carregar contas:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContas();
  }, [loadContas]);

  const addConta = useCallback(async (conta: Conta) => {
    if (!user) {
      toast.error("Usuário não autenticado");
      return false;
    }

    try {
      const { error } = await supabase
        .from("contas_bancarias")
        .insert([{
          id: conta.id || generateUUID(),
          nome: conta.nome,
          numero_conta: conta.numero_conta || null,
          banco: conta.banco || null,
          tipo_conta: conta.tipo_conta || "corrente",
          ativo: true,
          saldo: conta.saldo || 0,
          criado_por: user.id
        }]);

      if (error) {
        toast.error(`Erro ao salvar conta: ${error.message}`);
        return false;
      }

      await loadContas();
      toast.success("Conta adicionada com sucesso!");
      return true;
    } catch (error: any) {
      toast.error(`Erro ao salvar conta: ${error.message}`);
      return false;
    }
  }, [user, loadContas]);

  const updateConta = useCallback(async (id: string, updates: Partial<Conta>) => {
    try {
      const updateData: any = {};

      if (updates.nome !== undefined) updateData.nome = updates.nome;
      if (updates.numero_conta !== undefined) updateData.numero_conta = updates.numero_conta || null;
      if (updates.banco !== undefined) updateData.banco = updates.banco || null;
      if (updates.tipo_conta !== undefined) updateData.tipo_conta = updates.tipo_conta;
      if (updates.ativo !== undefined) updateData.ativo = updates.ativo;
      if (updates.saldo !== undefined) updateData.saldo = updates.saldo;

      updateData.atualizado_em = new Date().toISOString();

      const { error } = await supabase
        .from("contas_bancarias")
        .update(updateData)
        .eq("id", id);

      if (error) {
        toast.error(`Erro ao atualizar conta: ${error.message}`);
        return false;
      }

      await loadContas();
      toast.success("Conta atualizada com sucesso!");
      return true;
    } catch (error: any) {
      toast.error(`Erro ao atualizar conta: ${error.message}`);
      return false;
    }
  }, [loadContas]);

  const deleteConta = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("contas_bancarias")
        .update({
          ativo: false,
          atualizado_em: new Date().toISOString()
        })
        .eq("id", id);

      if (error) {
        toast.error(`Erro ao excluir conta: ${error.message}`);
        return false;
      }

      await loadContas();
      toast.success("Conta excluída com sucesso!");
      return true;
    } catch (error: any) {
      toast.error(`Erro ao excluir conta: ${error.message}`);
      return false;
    }
  }, [loadContas]);

  return {
    categorias,
    contas,
    isLoading: isLoading || categoriasLoading,
    addConta,
    updateConta,
    deleteConta,
    refetch: loadContas
  };
}

export function useCategoriasFinanceiroFormatted() {
  const categorias = useCategoriasFinanceiro();
  return categorias.categorias;
}
