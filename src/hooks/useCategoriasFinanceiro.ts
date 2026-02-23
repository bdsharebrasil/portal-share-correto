import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  fetchCategorias,
  addCategoriaService,
  updateCategoriaService,
  deleteCategoriaService,
} from "@/modules/core-finance/services/categorias";
import {
  fetchContas,
  addContaService,
  updateContaService,
  deleteContaService,
} from "@/modules/core-finance/services/contas";

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
  grupo_categoria?: string | null;
  descricao?: string;
  ativo?: boolean;
  reembolsavel?: boolean;
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
      const mapped = await fetchCategorias();
      setCategorias(mapped as any);
    } catch (error) {
      console.error("Erro ao carregar categorias:", error);
      toast.error("Erro ao carregar categorias");
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
      await addCategoriaService(categoria, (user as any).id);
      await loadCategorias();
      return true;
    } catch (error: any) {
      toast.error(`Erro ao criar categoria: ${error.message}`);
      return false;
    }
  }, [user, loadCategorias]);

  const updateCategoria = useCallback(async (id: string, updates: Partial<CategoriaFinanceiro>) => {
    try {
      await updateCategoriaService(id, updates);
      await loadCategorias();
      return true;
    } catch (error: any) {
      toast.error(`Erro ao atualizar categoria: ${error.message}`);
      return false;
    }
  }, [loadCategorias]);

  const deleteCategoria = useCallback(async (id: string) => {
    try {
      await deleteCategoriaService(id);
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

  const getCategoriasEntrada = useCallback(() => {
    return categorias.filter(cat => cat.tipo === "receita");
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
    getCategoriasEntrada,
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
      const mapped = await fetchContas();
      setContas(mapped as any);
    } catch (error) {
      console.error("Erro ao carregar contas:", error);
      toast.error("Erro ao carregar contas");
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
      await addContaService(conta, (user as any).id);
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
      await updateContaService(id, updates);
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
      await deleteContaService(id);
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
