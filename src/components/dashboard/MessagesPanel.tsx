import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function MessagesPanel() {
  const navigate = useNavigate();

  // Messages table disabled - table does not exist in Supabase
  const { data: messages = [] } = useQuery({
    queryKey: ["dashboard-messages"],
    queryFn: async () => {
      return [];
    },
    enabled: false,
  });

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border p-4 h-fit">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Recados</h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-primary hover:text-primary/80"
          onClick={() => navigate("/recados")}
        >
          <Plus className="h-4 w-4 mr-1" />
          Novo
        </Button>
      </div>

      {messages.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <MessageSquare className="mx-auto h-10 w-10 mb-2 opacity-50" />
          <p className="text-sm">Nenhum recado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg: any) => (
            <div 
              key={msg.id} 
              className="p-3 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => navigate("/recados")}
            >
              <div className="flex items-start justify-between mb-1">
                <h4 className="font-medium text-foreground text-sm line-clamp-1">{msg.title}</h4>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{msg.content}</p>
              {msg.author && (
                <p className="text-xs text-primary/80 mt-2">Por: {msg.author}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
