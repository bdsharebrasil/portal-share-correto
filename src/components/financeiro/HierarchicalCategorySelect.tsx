import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Check, FolderOpen, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCategorias, type Categoria } from "@/hooks/useCategorias";

interface CategoryNode extends Categoria {
  children: CategoryNode[];
}

interface HierarchicalCategorySelectProps {
  value?: string;
  onValueChange: (categoryId: string, categoryName: string) => void;
  placeholder?: string;
  className?: string;
}

export function HierarchicalCategorySelect({
  value,
  onValueChange,
  placeholder = "Selecione uma categoria",
  className,
}: HierarchicalCategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const { data: categorias, isLoading } = useCategorias();

  // Build tree structure from flat categories
  const categoryTree = useMemo(() => {
    if (!categorias) return [];

    const nodeMap = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];

    // First pass: create all nodes
    categorias.forEach(cat => {
      nodeMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree
    categorias.forEach(cat => {
      const node = nodeMap.get(cat.id)!;
      if (cat.categoria_pai_id && nodeMap.has(cat.categoria_pai_id)) {
        // Has parent - using categoria_pai_id as parent reference
        nodeMap.get(cat.categoria_pai_id)!.children.push(node);
      } else {
        // Is root
        roots.push(node);
      }
    });

    // Sort by grupo_categoria and name
    const sortNodes = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes.sort((a, b) => {
        const groupA = a.grupo_categoria || '';
        const groupB = b.grupo_categoria || '';
        if (groupA !== groupB) return groupA.localeCompare(groupB);
        return a.nome.localeCompare(b.nome);
      }).map(node => ({
        ...node,
        children: sortNodes(node.children)
      }));
    };

    return sortNodes(roots);
  }, [categorias]);

  // Group categories by grupo_categoria
  const groupedCategories = useMemo(() => {
    const groups = new Map<string, CategoryNode[]>();
    
    categoryTree.forEach(cat => {
      const group = cat.grupo_categoria || 'Outros';
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(cat);
    });

    return groups;
  }, [categoryTree]);

  const selectedCategory = useMemo(() => {
    return categorias?.find(c => c.id === value);
  }, [categorias, value]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const handleSelect = (cat: CategoryNode) => {
    onValueChange(cat.id, cat.nome);
    setOpen(false);
  };

  const renderNode = (node: CategoryNode, depth: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = value === node.id;

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent transition-colors",
            isSelected && "bg-primary/20 text-primary",
            depth > 0 && "ml-4"
          )}
          style={{ paddingLeft: `${(depth * 12) + 8}px` }}
          onClick={() => handleSelect(node)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpand(node.id, e)}
              className="p-0.5 hover:bg-accent rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          
          {hasChildren ? (
            <FolderOpen className="h-4 w-4 text-amber-500" />
          ) : (
            <Tag className="h-4 w-4 text-muted-foreground" />
          )}
          
          <span className="flex-1 text-sm truncate">{node.nome}</span>
          
          {node.tipo && (
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded",
              node.tipo === 'Entrada' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}>
              {node.tipo === 'Entrada' ? 'E' : 'S'}
            </span>
          )}
          
          {isSelected && <Check className="h-4 w-4 text-primary" />}
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-gray-800 border-gray-600 text-white hover:bg-gray-700",
            !selectedCategory && "text-muted-foreground",
            className
          )}
        >
          {selectedCategory ? (
            <div className="flex items-center gap-2 truncate">
              <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">
                {selectedCategory.grupo_categoria && (
                  <span className="text-muted-foreground">{selectedCategory.grupo_categoria} / </span>
                )}
                {selectedCategory.nome}
              </span>
            </div>
          ) : (
            placeholder
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 bg-gray-900 border-gray-700" align="start">
        <ScrollArea className="h-[300px] p-2">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Carregando...</div>
          ) : (
            Array.from(groupedCategories.entries()).map(([group, cats]) => (
              <div key={group} className="mb-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 mb-1">
                  {group}
                </div>
                {cats.map(cat => renderNode(cat))}
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
