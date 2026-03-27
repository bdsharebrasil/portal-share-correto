import { useState, useCallback, useEffect } from "react";
import {
  validateReceiptForm,
  ReceiptFormData,
  ReceiptType,
  ValidationError,
} from "@/lib/receiptUtils";

// Função utilitária para obter data local no formato YYYY-MM-DD (sem conversão UTC)
function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface ReceiptFormState {
  // Dados do recibo
  dataEmissao: string;
  valor: string;
  servico: string;
  prazoMaximoQuitacao: string;
  receiptType: ReceiptType;
  formaPagamento: string;
  reembolsoCategoriaId: string;
  reembolsoCategoriaGrupo: string;
  // Dados de reembolso
  reembolsoValorTotal: string;
  reembolsoPorcentagem: string;
  reembolsoValorCliente: string;
  reembolsoBoletoFile: File | null;
  reembolsoNotaFiscalFile: File | null;
  // Dados do pagador
  pagadorNome: string;
  pagadorDocumento: string;
  pagadorEndereco: string;
  pagadorCidade: string;
  pagadorUF: string;
  addAsFavorite: boolean;
  selectedClienteId: string;
  selectedAircraftId: string;
}

const INITIAL_STATE: ReceiptFormState = {
  dataEmissao: getLocalDateString(),
  valor: "",
  servico: "",
  prazoMaximoQuitacao: "",
  receiptType: "pagamento",
  formaPagamento: "",
  reembolsoCategoriaId: "",
  reembolsoCategoriaGrupo: "",
  reembolsoValorTotal: "",
  reembolsoPorcentagem: "",
  reembolsoValorCliente: "",
  reembolsoBoletoFile: null,
  reembolsoNotaFiscalFile: null,
  pagadorNome: "",
  pagadorDocumento: "",
  pagadorEndereco: "",
  pagadorCidade: "",
  pagadorUF: "",
  addAsFavorite: false,
  selectedClienteId: "",
  selectedAircraftId: "",
};

export function useReceiptForm() {
  const [form, setForm] = useState<ReceiptFormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [hasStartedEditing, setHasStartedEditing] = useState(false);

  // Validação em tempo real com debounce - APENAS após o usuário começar a editar
  useEffect(() => {
    // Se o usuário ainda não começou a editar, não validar
    if (!hasStartedEditing) {
      // Garantir que não há erros exibidos se não começou a editar
      if (errors.length > 0) {
        setErrors([]);
      }
      return;
    }

    const timer = setTimeout(() => {
      // Se todos os campos obrigatórios ainda estão vazios, limpar erros
      if (!form.valor && !form.servico && !form.pagadorNome && !form.pagadorDocumento) {
        setErrors([]);
        return;
      }

      setIsValidating(true);
      const amountNum = form.valor ? parseFloat(form.valor.replace(",", ".")) : 0;
      
      const formData: ReceiptFormData = {
        dataEmissao: form.dataEmissao,
        valor: amountNum,
        servicoDescricao: form.servico,
        pagadorNome: form.pagadorNome,
        pagadorDocumento: form.pagadorDocumento,
        pagadorEndereco: form.pagadorEndereco,
        pagadorCidade: form.pagadorCidade,
        pagadorUF: form.pagadorUF,
        receiptType: form.receiptType,
        prazoMaximoQuitacao: form.prazoMaximoQuitacao,
        formaPagamento: form.formaPagamento,
        clienteId: form.selectedClienteId,
        aircraftId: form.selectedAircraftId,
        reembolsoCategoriaId: form.reembolsoCategoriaId,
        reembolsoValorTotal: form.reembolsoValorTotal,
        reembolsoPorcentagem: form.reembolsoPorcentagem,
      };

      const newErrors = validateReceiptForm(formData);
      setErrors(newErrors);
      setIsValidating(false);
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timer);
  }, [form.valor, form.servico, form.pagadorNome, form.pagadorDocumento, form.pagadorUF, form.dataEmissao, form.prazoMaximoQuitacao, form.receiptType, form.reembolsoValorTotal, form.reembolsoPorcentagem, form.reembolsoCategoriaId, hasStartedEditing]);

  const updateField = useCallback((field: keyof ReceiptFormState, value: any) => {
    setHasStartedEditing(true);
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const updatePayer = useCallback((data: Partial<ReceiptFormState>) => {
    // updatePayer é usado para carregar dados de cliente sugerido
    // Não deve marcar como "começou a editar" ainda
    setForm((prev) => ({
      ...prev,
      ...data,
    }));
  }, []);

  const reset = useCallback(() => {
    setForm(INITIAL_STATE);
    setErrors([]);
    setHasStartedEditing(false);
  }, []);

  const getFormDataForSubmit = useCallback((): ReceiptFormData | null => {
    const amountNum = form.valor ? parseFloat(form.valor.replace(",", ".")) : 0;

    const formData: ReceiptFormData = {
      dataEmissao: form.dataEmissao,
      valor: amountNum,
      servicoDescricao: form.servico,
      pagadorNome: form.pagadorNome,
      pagadorDocumento: form.pagadorDocumento,
      pagadorEndereco: form.pagadorEndereco,
      pagadorCidade: form.pagadorCidade,
      pagadorUF: form.pagadorUF,
      receiptType: form.receiptType,
      prazoMaximoQuitacao: form.prazoMaximoQuitacao,
      formaPagamento: form.formaPagamento,
      clienteId: form.selectedClienteId,
      aircraftId: form.selectedAircraftId,
      reembolsoCategoriaId: form.reembolsoCategoriaId,
      reembolsoValorTotal: form.reembolsoValorTotal,
      reembolsoPorcentagem: form.reembolsoPorcentagem,
    };

    const validationErrors = validateReceiptForm(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return null;
    }

    return formData;
  }, [form]);

  const getReembolsoData = useCallback(() => {
    if (form.receiptType !== "reembolso") {
      return null;
    }

    // Normalizar valor total: remover ponto (separador de milhares) e substituir vírgula por ponto
    const valorTotalStr = form.reembolsoValorTotal
      .replace(/\./g, "")
      .replace(/,/g, ".");
    const valorTotal = valorTotalStr ? parseFloat(valorTotalStr) : 0;
    const porcentagem = form.reembolsoPorcentagem ? parseFloat(form.reembolsoPorcentagem) : 0;
    const valorCliente = valorTotal * (porcentagem / 100);

    return {
      categoriaId: form.reembolsoCategoriaId,
      valorTotal,
      porcentagem,
      valorCliente,
      boletoFile: form.reembolsoBoletoFile,
      notaFiscalFile: form.reembolsoNotaFiscalFile,
    };
  }, [form]);

  // Validação básica: todos os campos obrigatórios preenchidos sem erros
  // Se o usuário ainda não começou a editar, o formulário começa como válido (não bloqueia o envio)
  // Erros são mostrados apenas depois que o usuário começar a editar
  const isValid = (
    errors.length === 0 &&
    form.pagadorNome?.trim() &&
    form.pagadorDocumento?.trim() &&
    form.servico?.trim() &&
    form.valor &&
    parseFloat(form.valor) > 0
    // Campos de reembolso são opcionais no recibo - podem ser preenchidos depois
  );

  return {
    form,
    errors,
    isValidating,
    isValid,
    hasStartedEditing,
    updateField,
    updatePayer,
    reset,
    getFormDataForSubmit,
    getReembolsoData,
  };
}
