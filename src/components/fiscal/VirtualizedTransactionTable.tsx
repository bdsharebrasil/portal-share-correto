import React, { useMemo, useState } from "react";
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
  ArrowUp,
  ArrowDown,
  GripHorizontal,
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

type SortField = "data" | "tipo_movimento" | "valor" | null;
type SortDirection = "asc" | "desc";
type ColumnType = "checkbox" | "data" | "tipo" | "descricao" | "categoria" | "valor" | "status" | "anexos" | "actions";

interface VirtualizedTransactionTableProps {
  transactions: TransactionData[];
  selectedIds: Set<string>;
  onSelectChange: (id: string) => void;
  onEdit: (transaction: TransactionData) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSortChange?: (field: SortField, direction: SortDirection) => void;
  columnOrder?: ColumnType[];
  onColumnOrderChange?: (order: ColumnType[]) => void;
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
    if (status === "pendente") return "bg-orange-900/20 text-orange-400 border-orange-600";
    if (status === "pago") return "bg-green-900/20 text-green-400 border-green-600";
  }
  if (tipoMovimento === "saida") {
    if (status === "recebido") return "bg-blue-900/20 text-blue-400 border-blue-600";
    if (status === "pago") return "bg-red-900/20 text-red-400 border-red-600";
    if (status === "pendente") return "bg-orange-900/20 text-orange-400 border-orange-600";
  }
  switch (status) {
    case "pendente":
      return "bg-orange-900/20 text-orange-400 border-orange-600";
    case "recebido":
      return "bg-blue-900/20 text-blue-400 border-blue-600";
    case "pago":
      return "bg-red-900/20 text-red-400 border-red-600";
    case "cancelado":
      return "bg-red-900/20 text-red-400 border-red-600";
    default:
      return "bg-gray-700 text-gray-300 border-gray-600";
  }
};

const getValueColor = (status: string, tipoMovimento: string): string => {
  if (tipoMovimento === "entrada") {
    switch (status) {
      case "pendente":
        return "text-orange-400";
      case "recebido":
        return "text-blue-400";
      case "pago":
        return "text-green-400";
      default:
        return "text-green-400";
    }
  } else {
    // saida
    switch (status) {
      case "pendente":
        return "text-orange-400";
      case "recebido":
        return "text-blue-400";
      case "pago":
        return "text-red-400";
      default:
        return "text-red-400";
    }
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
      <div className="w-32 flex-shrink-0">
        <div className="flex items-center gap-1">
          {isEntrada ? (
            <ArrowUpCircle className="w-4 h-4 text-green-400" />
          ) : (
            <ArrowDownCircle className="w-4 h-4 text-red-400" />
          )}
          <span
            className={`text-xs font-medium ${
              isEntrada ? "text-green-400" : "text-red-400"
            }`}
          >
            {isEntrada ? "Entrada" : "Saída"}
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
          className={`text-sm font-semibold ${getValueColor(
            transaction.status,
            transaction.tipo_movimento
          )}`}
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

const defaultColumnOrder: ColumnType[] = [
  "checkbox",
  "data",
  "tipo",
  "descricao",
  "categoria",
  "valor",
  "status",
  "anexos",
  "actions",
];

export const VirtualizedTransactionTable = ({
  transactions,
  selectedIds,
  onSelectChange,
  onEdit,
  onDelete,
  isLoading = false,
  sortField = null,
  sortDirection = "asc",
  onSortChange = () => {},
  columnOrder = defaultColumnOrder,
  onColumnOrderChange = () => {},
}: VirtualizedTransactionTableProps) => {
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Ordenar transações com entradas primeiro, depois saídas
  const sortedTransactions = useMemo(() => {
    const sorted = [...transactions];

    // Primeiro separar entradas e saídas
    const entradas = sorted.filter((t) => t.tipo_movimento === "entrada");
    const saidas = sorted.filter((t) => t.tipo_movimento === "saida");

    // Depois ordenar cada grupo
    const sortGroup = (group: TransactionData[]) => {
      if (!sortField) return group;

      return group.sort((a: any, b: any) => {
        let aValue: any = a[sortField];
        let bValue: any = b[sortField];

        if (sortField === "data") {
          aValue = new Date(a.data).getTime();
          bValue = new Date(b.data).getTime();
        } else if (sortField === "valor") {
          aValue = Number(a.valor);
          bValue = Number(b.valor);
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    };

    return [...sortGroup(entradas), ...sortGroup(saidas)];
  }, [transactions, sortField, sortDirection]);

  const handleColumnClick = (field: SortField) => {
    if (!field) return;

    if (sortField === field) {
      // Toggle direction
      onSortChange(field, sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, start with asc
      onSortChange(field, "asc");
    }
  };

  const handleColumnDragStart = (e: React.DragEvent, column: ColumnType) => {
    setDraggedColumn(column);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleColumnDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleColumnDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (!draggedColumn) return;

    const dragIndex = columnOrder.indexOf(draggedColumn);
    if (dragIndex === dropIndex) {
      setDraggedColumn(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...columnOrder];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, draggedColumn);

    onColumnOrderChange(newOrder);
    setDraggedColumn(null);
    setDragOverIndex(null);
  };

  const handleColumnDragLeave = () => {
    setDragOverIndex(null);
  };

  const itemData = useMemo(
    () => ({
      transactions: sortedTransactions,
      selectedIds,
      onSelectChange,
      onEdit,
      onDelete,
    }),
    [sortedTransactions, selectedIds, onSelectChange, onEdit, onDelete]
  );

  const renderColumnHeader = (label: string, field: SortField | null, index: number, column: ColumnType) => {
    const isSorted = sortField === field && field !== null;
    const isEntryColumn = field !== null && (field === "data" || field === "valor");

    return (
      <div
        key={`header-${column}`}
        draggable
        onDragStart={(e) => handleColumnDragStart(e, column)}
        onDragOver={(e) => handleColumnDragOver(e, index)}
        onDrop={(e) => handleColumnDrop(e, index)}
        onDragLeave={handleColumnDragLeave}
        className={`flex items-center gap-2 cursor-move transition-colors ${
          dragOverIndex === index ? "bg-primary/20" : ""
        } ${column === draggedColumn ? "opacity-50" : ""}`}
      >
        <GripHorizontal className="w-3 h-3 text-foreground/30" />
        {isEntryColumn ? (
          <button
            onClick={() => handleColumnClick(field)}
            className="flex items-center gap-1 hover:text-primary transition-colors flex-1 text-left py-1"
          >
            <span className="text-xs uppercase tracking-wider text-foreground/60 font-medium flex items-center gap-1">
              {label}
              {isSorted && (
                sortDirection === "asc" ? (
                  <ArrowUp className="w-3 h-3 text-primary" />
                ) : (
                  <ArrowDown className="w-3 h-3 text-primary" />
                )
              )}
            </span>
          </button>
        ) : (
          <span className="text-xs uppercase tracking-wider text-foreground/60 font-medium">
            {label}
          </span>
        )}
      </div>
    );
  };

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

  const columnConfigs = {
    checkbox: { label: "Seleção", width: "w-12", field: null },
    data: { label: "Data", width: "w-24", field: "data" as SortField },
    tipo: { label: "Tipo", width: "w-32", field: null },
    descricao: { label: "Descrição", width: "flex-1", field: null },
    categoria: { label: "Categoria", width: "w-32", field: null },
    valor: { label: "Valor", width: "w-28", field: "valor" as SortField },
    status: { label: "Status", width: "w-24", field: null },
    anexos: { label: "Anexos", width: "w-48", field: null },
    actions: { label: "", width: "w-12", field: null },
  };

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-4 px-4 py-3 bg-muted/50 backdrop-blur-sm border-b border-border/40">
        {columnOrder.map((column, index) => {
          const config = columnConfigs[column];
          if (!config) return null;

          if (column === "checkbox") {
            return (
              <div key={column} className={config.width}>
                <Checkbox
                  checked={
                    sortedTransactions.length > 0 &&
                    selectedIds.size === sortedTransactions.length
                  }
                  onCheckedChange={() => {
                    if (selectedIds.size === sortedTransactions.length) {
                      sortedTransactions.forEach((t) => onSelectChange(t.id));
                    } else {
                      selectedIds.forEach((id) => onSelectChange(id));
                    }
                  }}
                  className="h-5 w-5"
                />
              </div>
            );
          }

          return (
            <div key={column} className={`${config.width} flex-shrink-0`}>
              {renderColumnHeader(config.label, config.field, index, column)}
            </div>
          );
        })}
      </div>

      {/* Horizontal Scroll Container */}
      <div className="overflow-x-auto">
        {/* Virtualized List */}
        <List
          height={600}
          itemCount={sortedTransactions.length}
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
