import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash, Edit2, Plus, Check, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
interface Description {
  id: string;
  description: string;
}
export function DescriptionManager() {
  const [descriptions, setDescriptions] = useState<Description[]>([]);
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  useEffect(() => {
    loadDescriptions();
  }, []);
  async function loadDescriptions() {
    const {
      data
    } = await supabase.from("receipt_descriptions").select("*").order("criado_em", {
      ascending: false
    });
    setDescriptions(data || []);
  }
  async function addDescription() {
    if (!newDescription.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma descrição",
        variant: "destructive"
      });
      return;
    }
    const {
      error
    } = await supabase.from("receipt_descriptions").insert([{
      description: newDescription
    }]);
    if (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Descrição adicionada com sucesso!"
    });
    setNewDescription("");
    setIsAdding(false);
    await loadDescriptions();
  }
  async function updateDescription(id: string) {
    if (!editingText.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma descrição",
        variant: "destructive"
      });
      return;
    }
    const {
      error
    } = await supabase.from("receipt_descriptions").update({
      description: editingText
    }).eq("id", id);
    if (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Descrição atualizada!"
    });
    setEditingId(null);
    setEditingText("");
    await loadDescriptions();
  }
  async function deleteDescription(id: string) {
    const {
      error
    } = await supabase.from("receipt_descriptions").delete().eq("id", id);
    if (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Descrição excluída!"
    });
    await loadDescriptions();
  }
  return <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Descrições Favoritas</CardTitle>
          <Button onClick={() => setIsAdding(true)} size="sm" className="bg-custom-cyan hover:bg-custom-cyan/90 rounded-sm bg-slate-400 hover:bg-slate-300">
            <Plus className="h-4 w-4 mr-2" />
            Nova Descrição
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdding && <div className="flex gap-2 p-3 border border-border rounded-lg bg-accent/50">
            <Input placeholder="Digite a descrição..." value={newDescription} onChange={e => setNewDescription(e.target.value)} onKeyDown={e => e.key === "Enter" && addDescription()} />
            <Button size="sm" onClick={addDescription} variant="default">
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => {
          setIsAdding(false);
          setNewDescription("");
        }} variant="outline">
              <X className="h-4 w-4" />
            </Button>
          </div>}

        {descriptions.length === 0 ? <p className="text-muted-foreground text-center py-8">
            Nenhuma descrição cadastrada ainda
          </p> : descriptions.map(desc => <div key={desc.id} className="flex justify-between items-center border border-border rounded-lg p-3 hover:bg-accent transition-colors">
              {editingId === desc.id ? <div className="flex gap-2 flex-1">
                  <Input value={editingText} onChange={e => setEditingText(e.target.value)} onKeyDown={e => e.key === "Enter" && updateDescription(desc.id)} className="flex-1" />
                  <Button size="sm" onClick={() => updateDescription(desc.id)} variant="default">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={() => {
            setEditingId(null);
            setEditingText("");
          }} variant="outline">
                    <X className="h-4 w-4" />
                  </Button>
                </div> : <>
                  <p className="text-foreground">{desc.descricao}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
              setEditingId(desc.id);
              setEditingText(desc.descricao);
            }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteDescription(desc.id)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </>}
            </div>)}
      </CardContent>
    </Card>;
}