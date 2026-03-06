import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Category {
  id: string;
  nome: string;
}

interface GroupedCategory {
  grupo: string;
  categorias: Category[];
}

interface CategoryGroupSelectProps {
  groups: GroupedCategory[];
  value: string;
  onSelect: (categoryName: string) => void;
  placeholder?: string;
}

export function CategoryGroupSelect({
  groups,
  value,
  onSelect,
  placeholder = "Selecione uma categoria"
}: CategoryGroupSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.map(g => g.grupo))
  );

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const handleSelectCategory = (categoryName: string) => {
    onSelect(categoryName);
    setIsOpen(false);
  };

  const selectedCategory = groups
    .flatMap(g => g.categorias)
    .find(c => c.nome === value)?.nome;

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="w-full justify-start bg-background text-foreground hover:bg-muted/50"
      >
        {selectedCategory || placeholder}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecione o grupo</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {groups.map((group) => (
              <div key={group.grupo}>
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.grupo)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors border border-border/50 group"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {expandedGroups.has(group.grupo) ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="font-semibold text-foreground text-sm uppercase tracking-wide">
                      {group.grupo}
                    </span>
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                    {group.categorias.length}
                  </span>
                </button>

                {/* Group Content */}
                {expandedGroups.has(group.grupo) && (
                  <div className="mt-2 ml-4 space-y-1 border-l-2 border-primary/20 pl-4">
                    {group.categorias.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleSelectCategory(category.nome)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          value === category.nome
                            ? "bg-primary/20 text-primary font-semibold"
                            : "text-foreground hover:bg-muted/50"
                        }`}
                      >
                        {category.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
