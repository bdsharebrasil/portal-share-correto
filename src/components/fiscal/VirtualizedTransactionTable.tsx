import React, { useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  ChevronDown,
  Edit2,
  Trash2,
  FileText,
  File,
  Link2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransactionData {
  id: string;
  data: string;
  tipo_movimento: "entrada" | "saida";
  descricao: string;
  valor: number;
  status: string;
  categoria_nome?: string;
  cliente_nome?: string;
  conta_banco?: string;
  nf_url?: string;
  boleto_url?: string;
  recibo_url?: string;
  comprovante_url?: string;
  [key: string]: any;
}

interface VirtualizedTransactionTableProps {
  transactions: TransactionData[];
  selectedIds: Set<string>;
  onSelectChange: (id: string) => void;
  onEdit: (transaction: TransactionData) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

const AttachmentLinks = ({ transaction }: { transaction: TransactionData }) => {
  const attachments = [
    { label: "NF", url: transaction.nf_url, icon: FileText },
    { label: "Boleto", url: transaction.boleto_url, icon: File },
    { label: "Recibo", url: transaction.recibo_url, icon: File },
    { label: "Comprovante", url: transaction.comprovante_url, icon: File },
  ].filter(({ url }) => url);

  if (attachments.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {attachments.map(({ label, url, icon: Icon }) => (
        <a
          key={label}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted/50 hover:bg-primary/20 text-xs text-foreground/80 hover:text-primary transition-colors"
          title={label}
        >
          <Icon className="w-3 h-3" />
          <span className="hidden sm:inline">{label}</span>
        </a>
      ))}
    </div>
  );
};

const getStatusColor = (status: string, tipoMovimento?: string): string => {
  if (tipoMovimento === "entrada") {
    if (status === "recebido") return "bg-blue-900/20 text-blue-400 border-blue-600";
    if (status === "pago") return "bg-green-900/20 text-green-400 border-green-600";
    if (status === "pendente") return "bg-orange-900/20 text-orange-400 border-orange-600";
  }
  if (tipoMovimento === "saida") {
    if (status === "recebido") return "bg-blue-900/20 text-blue-400 border-blue-600";
    if (status === "pago") return "bg-red-900/20 text-red-400 border-red-600";
  }
  switch (status) {
    case "pendente":
      return "bg-yellow-900/20 text-yellow-400 border-yellow-600";
    case "cancelado":
      return "bg-red-900/20 text-red-400 border-red-600";
    default:
      return "bg-gray-700 text-gray-300 border-gray-600";
  }
};

const Row = ({
  index,
  style,
  data: { transactions, selectedIds, onSelectChange, onEdit, onDelete },
}: {
  index: number;
  style: React.CSSProperties;
  data: {
    transactions: TransactionData[];
    selectedIds: Set<string>;
    onSelectChange: (id: string) => void;
    onEdit: (transaction: TransactionData) => void;
    onDelete: (id: string) => void;
  };
}) => {
  const transaction = transactions[index];
  const isSelected = selectedIds.has(transaction.id);
  const isEntrada = transaction.tipo_movimento === "entrada";
  const isPendente = transaction.status === "pendente";

  return (
    <motion.div
      style={style}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: index * 0.01 }}
      className={`flex items-center gap-4 px-4 border-b border-border/40 transition-colors ${
        isSelected
          ? "bg-blue-900/20"
          : isEntrada && isPendente
          ? "bg-orange-900/20"
          : "hover:bg-muted/30"
      }`}
    >
      {/* Checkbox */}
      <div className="w-12 flex-shrink-0">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelectChange(transaction.id)}
          className="h-5 w-5"
        />
      </div>

      {/* Data */}
      <div className="w-24 flex-shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-foreground/50 text-xs font-semibold">
            #{index + 1}
          </span>
          <span className="text-sm text-foreground/80">
            {(() => {
              const dateStr = transaction.data;
              if (dateStr && dateStr.length === 10) {
                const [year, month, day] = dateStr.split("-").map(Number);
                const date = new Date(year, month - 1, day);
                return format(date, "dd/MM", { locale: ptBR });
              }
              return format(new Date(transaction.data), "dd/MM", {
                locale: ptBR,
              });
            })()}
          </span>
        </div>
      </div>

      {/* Tipo */}
      <div className="w-20 flex-shrink-0">
        <div className="flex items-center gap-1">
          {isEntrada ? (
            <ArrowUpCircle
              className={`w-4 h-4 ${
                transaction.status === "recebido"
                  ? "text-blue-400"
                  : isPendente
                  ? "text-orange-400"
                  : "text-green-400"
              }`}
            />
          ) : (
            <ArrowDownCircle
              className={`w-4 h-4 ${
                transaction.status === "recebido"
                  ? "text-blue-400"
                  : "text-red-400"
              }`}
            />
          )}
          <span
            className={`text-xs font-medium ${
              isEntrada
                ? transaction.status === "recebido"
                  ? "text-blue-400"
                  : isPendente
                  ? "text-orange-400"
                  : "text-green-400"
                : transaction.status === "recebido"
                ? "text-blue-400"
                : "text-red-400"
            }`}
          >
            {isEntrada ? "E" : "S"}
          </span>
        </div>
      </div>

      {/* Descrição */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground font-medium truncate">
          {transaction.descricao}
        </p>
      </div>

      {/* Categoria */}
      <div className="w-32 flex-shrink-0">
        <p className="text-sm text-foreground/70 truncate">
          {transaction.categoria_nome || "-"}
        </p>
      </div>

      {/* Valor */}
      <div className="w-28 flex-shrink-0 text-right">
        <p
          className={`text-sm font-semibold ${
            isEntrada
              ? isPendente
                ? "text-orange-400"
                : "text-green-400"
              : "text-red-400"
          }`}
        >
          R${" "}
          {transaction.valor.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}
        </p>
      </div>

      {/* Status */}
      <div className="w-24 flex-shrink-0">
        {transaction.status ? (
          <Badge
            variant="outline"
            className={`text-xs ${getStatusColor(
              transaction.status,
              transaction.tipo_movimento
            )}`}
          >
            {transaction.status}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </div>

      {/* Anexos */}
      <div className="w-48 flex-shrink-0">
        <AttachmentLinks transaction={transaction} />
      </div>

      {/* Actions */}
      <div className="w-12 flex-shrink-0 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => onEdit(transaction)}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              <span>Editar</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(transaction.id)}
              className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              <span>Deletar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
};

export const VirtualizedTransactionTable = ({
  transactions,
  selectedIds,
  onSelectChange,
  onEdit,
  onDelete,
  isLoading = false,
}: VirtualizedTransactionTableProps) => {
  const itemData = useMemo(
    () => ({
      transactions,
      selectedIds,
      onSelectChange,
      onEdit,
      onDelete,
    }),
    [transactions, selectedIds, onSelectChange, onEdit, onDelete]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border b-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return null;
  }

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-4 px-4 py-3 bg-muted/50 backdrop-blur-sm border-b border-border/40">
        <div className="w-12 flex-shrink-0">
          <Checkbox
            checked={
              transactions.length > 0 && selectedIds.size === transactions.length
            }
            onCheckedChange={() => {
              if (selectedIds.size === transactions.length) {
                transactions.forEach((t) => onSelectChange(t.id));
              } else {
                selectedIds.forEach((id) => onSelectChange(id));
              }
            }}
            className="h-5 w-5"
          />
        </div>
        <div className="w-24 flex-shrink-0 text-xs uppercase tracking-wider text-foreground/60 font-medium">
          Data
        </div>
        <div className="w-20 flex-shrink-0 text-xs uppercase tracking-wider text-foreground/60 font-medium">
          Tipo
        </div>
        <div className="flex-1 text-xs uppercase tracking-wider text-foreground/60 font-medium">
          Descrição
        </div>
        <div className="w-32 flex-shrink-0 text-xs uppercase tracking-wider text-foreground/60 font-medium">
          Categoria
        </div>
        <div className="w-28 flex-shrink-0 text-right text-xs uppercase tracking-wider text-foreground/60 font-medium">
          Valor
        </div>
        <div className="w-24 flex-shrink-0 text-xs uppercase tracking-wider text-foreground/60 font-medium">
          Status
        </div>
        <div className="w-48 flex-shrink-0 text-xs uppercase tracking-wider text-foreground/60 font-medium">
          Anexos
        </div>
        <div className="w-12 flex-shrink-0" />
      </div>

      {/* Horizontal Scroll Container */}
      <div className="overflow-x-auto">
        {/* Virtualized List */}
        <List
          height={600}
          itemCount={transactions.length}
          itemSize={56}
          width="100%"
          itemData={itemData}
        >
          {Row}
        </List>
      </div>
    </div>
  );
};
