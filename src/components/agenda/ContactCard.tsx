import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Building2, Truck, MapPin, Phone, Mail, Edit, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ContactCardProps {
  contact: {
    id: string;
    nome: string;
    telefone?: string | null;
    email?: string | null;
    empresa?: string | null;
    cidade?: string | null;
    cargo?: string | null;
    categoria?: string | null;
    origin?: string | null;
    contato_financeiro?: string | null;
  };
  onEdit: (contact: any) => void;
  onDelete: (contact: any) => void;
  hideActionButtons?: boolean;
}

const getCategoryIcon = (categoria?: string | null) => {
  switch (categoria?.toLowerCase()) {
    case "colaboradores":
    case "colaborador":
      return <Users className="h-5 w-5 text-slate-300 flex-shrink-0" />;
    case "fornecedores":
    case "fornecedor":
      return <Truck className="h-5 w-5 text-slate-300 flex-shrink-0" />;
    case "clientes":
    case "cliente":
      return <Building2 className="h-5 w-5 text-slate-300 flex-shrink-0" />;
    default:
      return <Users className="h-5 w-5 text-slate-300 flex-shrink-0" />;
  }
};

export function ContactCard({
  contact,
  onEdit,
  onDelete,
  hideActionButtons = false,
}: ContactCardProps) {
  const isReadOnlyOrigin = contact.origin === "clientes" || contact.origin === "user_profiles";

  return (
    <Card className="group border-white/30 bg-slate-900/30 hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header with Name and Icon */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {getCategoryIcon(contact.categoria)}
                <h3 className="font-bold text-white text-lg uppercase">
                  {contact.nome}
                </h3>
              </div>
              {contact.cargo && (
                <div className="ml-8">
                  <p className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">
                    {contact.cargo}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {!hideActionButtons && !isReadOnlyOrigin && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(contact)}
                  className="h-8 w-8 p-0 hover:bg-slate-800"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-slate-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir contato</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir o contato "{contact.nome}"? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(contact)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {/* Company */}
          {contact.empresa && (
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-300">{contact.empresa}</span>
            </div>
          )}

          {/* Phone */}
          {contact.telefone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-300">{contact.telefone}</span>
            </div>
          )}

          {/* Email */}
          {contact.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-300">{contact.email}</span>
            </div>
          )}

          {/* City / Financial Contact */}
          {(contact.cidade || contact.contato_financeiro) && (
            <div className="border-t border-white/20 pt-3 space-y-2">
              {contact.cidade && (
                <p className="text-xs text-slate-400 flex items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0 text-red-500" />
                  <span>{contact.cidade}</span>
                </p>
              )}
              {contact.contato_financeiro && (
                <p className="text-xs text-slate-400">
                  <span className="text-slate-500">👤 Contato Financeiro:</span> {contact.contato_financeiro}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
