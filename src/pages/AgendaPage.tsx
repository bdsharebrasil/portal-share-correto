import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, Building, Truck, Hotel, Plus, Edit, Trash2 } from "lucide-react";
import { ContactModal } from "@/components/ContactModal";
import { ContactCard } from "@/components/agenda/ContactCard";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Contact, ContactFormData } from "@/types/agenda";
import type { TablesInsert, Enums } from "@/integrations/supabase/types";

type SupabaseContactRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  position: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  category?: string | null;
  address?: string | null;
  city?: string | null;
};

type SupabaseHotelRow = {
  id: string;
  nome: string;
  telefone: string | null;
  cidade: string | null;
  preco_single: string | number | null;
  preco_duplo: string | number | null;
  endereco: string | null;
};

type SupabaseClientRow = {
  id: string;
  cnpj: string | null;
  observations: string | null;
  created_at: string | null;
  updated_at: string | null;
  company_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  uf: string | null;
  status: string | null;
  aircraft_id: string | null;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const mapCategoryFromSupabase = (value?: string | null): "clientes" | "colaboradores" | "fornecedores" | "hoteis" => {
  switch (value) {
    case "Colaboradores":
    case "colaboradores":
    case "colaborador":
    case "funcionario":
      return "colaboradores";
    case "Fornecedores":
    case "fornecedores":
    case "fornecedor":
      return "fornecedores";
    case "Hoteis":
    case "hoteis":
    case "hotel":
      return "hoteis";
    case "Cliente":
    case "clientes":
    case "cliente":
    default:
      return "clientes";
  }
};

type ContactTypeEnum = Enums<'contact_type'>;

const localToContactType = (category: "clientes" | "colaboradores" | "fornecedores" | "hoteis"): ContactTypeEnum => {
  switch (category) {
    case "colaboradores":
      return "Colaboradores";
    case "fornecedores":
      return "Fornecedores";
    case "hoteis":
      return "Hoteis";
    case "clientes":
    default:
      return "Cliente";
  }
};

const buildContactPayload = (data: Partial<ContactFormData>): TablesInsert<'contacts'> => {
  const mappedType = localToContactType(data.categoria ?? "clientes");
  const payload: TablesInsert<'contacts'> = {
    name: data.nome || "",
    category: mappedType,
  };

  if (data.nome !== undefined) payload.name = data.nome;
  if (data.telefone !== undefined) payload.phone = data.telefone || null;
  if (data.email !== undefined) payload.email = data.email || null;
  if (data.empresa !== undefined) payload.company_name = data.empresa || null;
  if (data.cargo !== undefined) payload.position = data.cargo || null;
  if (data.observacoes !== undefined) payload.notes = data.observacoes || null;
  if (data.endereco !== undefined) payload.address = data.endereco || null;
  if (data.cidade !== undefined) payload.city = data.cidade || null;

  return payload;
};

const mapSupabaseContact = (row: SupabaseContactRow): any => ({
  id: row.id,
  nome: row.name,
  name: row.name,
  telefone: row.phone ?? "",
  email: row.email ?? undefined,
  empresa: row.company_name ?? undefined,
  cargo: row.position ?? undefined,
  categoria: mapCategoryFromSupabase(row.category),
  observacoes: row.notes ?? undefined,
  endereco: row.address ?? undefined,
  cidade: row.city ?? undefined,
  origin: "contacts",
  created_at: row.created_at ?? undefined,
  updated_at: row.updated_at ?? undefined,
});

const mapSupabaseHotel = (row: SupabaseHotelRow): any => ({
  id: row.id,
  nome: row.nome,
  name: row.nome,
  telefone: row.telefone ?? "",
  categoria: "hoteis" as const,
  endereco: row.endereco ?? undefined,
  cidade: row.cidade ?? undefined,
  precoSingle: row.preco_single !== null ? Number(row.preco_single) : undefined,
  precoDuplo: row.preco_duplo !== null ? Number(row.preco_duplo) : undefined,
  origin: "hoteis",
});

export default function AgendaPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any | undefined>();
  const [isHotelModalOpen, setIsHotelModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<any | undefined>();
  const [activeTab, setActiveTab] = useState<"colaboradores" | "fornecedores" | "hoteis" | "clientes">("colaboradores");
  const [hotelForm, setHotelForm] = useState({
    nome: "",
    telefone: "",
    cidade: "",
    endereco: "",
    preco_single: "",
    preco_duplo: "",
  });
  const [colaboradoresAll, setColaboradoresAll] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const { toast } = useToast();

  const loadColaboradores = useCallback(async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id,full_name,phone,email,created_at")
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;

      const userIds = (profiles ?? []).map((p) => p.id);

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id,role")
        .in("user_id", userIds);

      if (rolesError) throw rolesError;

      const rolesMap = new Map<string, string[]>();
      (rolesData ?? []).forEach((r) => {
        const roles = rolesMap.get(r.user_id) ?? [];
        roles.push(r.role);
        rolesMap.set(r.user_id, roles);
      });

      const colaboradoresData = (profiles ?? [])
        .map((profile) => ({
          id: profile.id,
          nome: profile.full_name,
          name: profile.full_name,
          telefone: profile.phone ?? "",
          email: profile.email ?? undefined,
          categoria: "colaboradores" as const,
          origin: "user_profiles",
          roles: rolesMap.get(profile.id) ?? [],
          created_at: profile.created_at ?? undefined,
        }))
        .filter((user) => {
          const roles = user.roles;
          const isAdmin = roles.includes("admin");
          const isCliente = roles.includes("cliente");
          const isCotista = roles.includes("cotista");
          return !isAdmin && !isCliente && !isCotista;
        });

      setColaboradoresAll(colaboradoresData);
      setColaboradores(colaboradoresData);
    } catch (error) {
      console.error("Erro ao carregar colaboradores:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar os colaboradores",
        variant: "destructive",
      });
    }
  }, [toast]);

  const loadContacts = useCallback(
    async (term?: string) => {
      try {
        setLoading(true);
        const normalizedTerm = term?.trim();
        const likePattern = normalizedTerm ? `%${normalizedTerm}%` : undefined;

        const contactsQuery = supabase
          .from("contacts")
          .select("id,name,phone,email,company_name,position,notes,created_at,updated_at,category,address,city")
          .order("name", { ascending: true });

        if (likePattern) {
          contactsQuery.or(
            `name.ilike.${likePattern},company_name.ilike.${likePattern},phone.ilike.${likePattern},email.ilike.${likePattern},city.ilike.${likePattern}`
          );
        }

        const hotelsQuery = supabase
          .from("hoteis")
          .select("*")
          .order("nome", { ascending: true });

        if (likePattern) {
          hotelsQuery.or(`nome.ilike.${likePattern},cidade.ilike.${likePattern},telefone.ilike.${likePattern}`);
        }

        const clientsQuery = supabase
          .from("clients")
          .select("id,cnpj,observations,created_at,updated_at,company_name,address,phone,email,city,uf,status,financial_contact")
          .eq("status", "ativo")
          .order("company_name", { ascending: true });

        if (likePattern) {
          clientsQuery.or(`company_name.ilike.${likePattern},phone.ilike.${likePattern},email.ilike.${likePattern},city.ilike.${likePattern}`);
        }

        const [contactsResult, hotelsResult, clientsResult] = await Promise.all([contactsQuery, hotelsQuery, clientsQuery]);

        if (contactsResult.error) throw contactsResult.error;
        if (hotelsResult.error) throw hotelsResult.error;
        if (clientsResult.error) throw clientsResult.error;

        const contactsData = (contactsResult.data as SupabaseContactRow[] | null)?.map(mapSupabaseContact) ?? [];
        const hotelsData = (hotelsResult.data as SupabaseHotelRow[] | null)?.map(mapSupabaseHotel) ?? [];
        const clientsData = (clientsResult.data as any[] | null)?.map((row) => ({
          id: row.id,
          nome: row.company_name ?? "",
          name: row.company_name ?? "",
          telefone: row.phone ?? "",
          email: row.email ?? undefined,
          empresa: row.company_name ?? undefined,
          cargo: undefined,
          categoria: "clientes" as const,
          observacoes: row.observations ?? undefined,
          endereco: row.address ?? undefined,
          cidade: row.city ?? undefined,
          financial_contact: row.financial_contact ?? undefined,
          origin: "clients",
          created_at: row.created_at ?? undefined,
          updated_at: row.updated_at ?? undefined,
        })) ?? [];

        setContacts([...contactsData, ...clientsData, ...hotelsData] as any);
      } catch (error) {
        console.error("Erro ao carregar contatos:", error);
        toast({
          title: "Erro",
          description: "Erro ao carregar os contatos",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadContacts();
    loadColaboradores();
  }, [loadContacts, loadColaboradores]);

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    await loadContacts(term.trim() ? term : undefined);

    if (term.trim()) {
      const normalizedTerm = term.toLowerCase();
      const filtered = colaboradoresAll.filter((c) =>
        c.nome.toLowerCase().includes(normalizedTerm) ||
        c.telefone?.toLowerCase().includes(normalizedTerm) ||
        c.email?.toLowerCase().includes(normalizedTerm)
      );
      setColaboradores(filtered);
    } else {
      setColaboradores(colaboradoresAll);
    }
  };

  const handleAddContact = () => {
    setEditingContact(undefined);
    setIsModalOpen(true);
  };

  const handleAddHotel = () => {
    setEditingHotel(undefined);
    setHotelForm({ nome: "", telefone: "", cidade: "", endereco: "", preco_single: "", preco_duplo: "" });
    setIsHotelModalOpen(true);
  };

  const handleEditContact = (contact: any) => {
    if (contact.origin === "hoteis") {
      setEditingHotel(contact);
      setHotelForm({
        nome: contact.nome || "",
        telefone: contact.telefone || "",
        cidade: contact.cidade || "",
        endereco: contact.endereco || "",
        preco_single: contact.precoSingle !== undefined ? String(contact.precoSingle) : "",
        preco_duplo: contact.precoDuplo !== undefined ? String(contact.precoDuplo) : "",
      });
      setIsHotelModalOpen(true);
      return;
    }

    setEditingContact(contact);
    setIsModalOpen(true);
  };

  const handleDeleteContact = async (contact: any) => {
    try {
      if (contact.origin === "hoteis") {
        const { error } = await supabase.from("hoteis").delete().eq("id", contact.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Hotel excluído com sucesso" });
        await loadContacts(searchTerm.trim() ? searchTerm : undefined);
        return;
      }

      const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Contato excluído com sucesso" });
      await loadContacts(searchTerm.trim() ? searchTerm : undefined);
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast({ title: "Erro", description: "Erro ao excluir registro", variant: "destructive" });
    }
  };

  const handleSaveContact = async (contactData: ContactFormData) => {
    try {
      const payload = buildContactPayload(contactData);
      const { error } = await supabase.from("contacts").insert(payload);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Contato adicionado com sucesso",
      });

      await loadContacts(searchTerm.trim() ? searchTerm : undefined);
    } catch (error) {
      console.error("Erro ao adicionar contato:", error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar contato",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateContact = async (id: string, updates: ContactFormData) => {
    try {
      const payload = buildContactPayload(updates);
      const { error } = await supabase.from("contacts").update(payload).eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Contato atualizado com sucesso",
      });

      await loadContacts(searchTerm.trim() ? searchTerm : undefined);
    } catch (error) {
      console.error("Erro ao atualizar contato:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar contato",
        variant: "destructive",
      });
      throw error;
    }
  };

  const filteredContacts = activeTab === "colaboradores"
    ? colaboradores
    : contacts.filter((c: any) => c.categoria === activeTab);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "colaboradores":
        return <Building className="h-4 w-4" />;
      case "fornecedores":
        return <Truck className="h-4 w-4" />;
      case "hoteis":
        return <Hotel className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "clientes":
        return "Clientes";
      case "colaboradores":
        return "Colaboradores";
      case "fornecedores":
        return "Fornecedores";
      case "hoteis":
        return "Hotéis";
      default:
        return "Outros";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "clientes":
        return "bg-blue-100 text-blue-800";
      case "colaboradores":
        return "bg-green-100 text-green-800";
      case "fornecedores":
        return "bg-orange-100 text-orange-800";
      case "hoteis":
        return "bg-pink-100 text-pink-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Agenda & Contatos</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie todos os seus contatos organizados por categorias
            </p>
          </div>
          {activeTab === "hoteis" ? (
            <Button onClick={handleAddHotel} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Hotel
            </Button>
          ) : (
            <Button onClick={handleAddContact} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Contato
            </Button>
          )}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por nome ou empresa..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          <TabsList className="mt-2 w-full grid grid-cols-4 gap-4 bg-transparent p-0 border-0">
            <TabsTrigger
              value="clientes"
              className="rounded-2xl overflow-hidden transition-all p-0 data-[state=inactive]:hover:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-blue-500 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background"
            >
              <div className="w-full bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-2xl overflow-hidden p-5 flex flex-col items-center gap-3">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">Clientes</p>
                </div>
              </div>
            </TabsTrigger>

            <TabsTrigger
              value="colaboradores"
              className="rounded-2xl overflow-hidden transition-all p-0 data-[state=inactive]:hover:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-emerald-500 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background"
            >
              <div className="w-full bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl overflow-hidden p-5 flex flex-col items-center gap-3">
                <div className="p-3 bg-emerald-500/20 rounded-xl">
                  <Building className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">Colaboradores</p>
                </div>
              </div>
            </TabsTrigger>

            <TabsTrigger
              value="fornecedores"
              className="rounded-2xl overflow-hidden transition-all p-0 data-[state=inactive]:hover:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-orange-500 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background"
            >
              <div className="w-full bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 rounded-2xl overflow-hidden p-5 flex flex-col items-center gap-3">
                <div className="p-3 bg-orange-500/20 rounded-xl">
                  <Truck className="h-6 w-6 text-orange-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">Fornecedores</p>
                </div>
              </div>
            </TabsTrigger>

            <TabsTrigger
              value="hoteis"
              className="rounded-2xl overflow-hidden transition-all p-0 data-[state=inactive]:hover:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-violet-500 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background"
            >
              <div className="w-full bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 rounded-2xl overflow-hidden p-5 flex flex-col items-center gap-3">
                <div className="p-3 bg-violet-500/20 rounded-xl">
                  <Hotel className="h-6 w-6 text-violet-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">Hotéis</p>
                </div>
              </div>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="w-full mt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Carregando...</div>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-muted-foreground">
                  {searchTerm
                    ? `Nenhum contato encontrado para "${searchTerm}".`
                    : "Nenhum contato cadastrado ainda."}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(activeTab)}
                    <h2 className="text-xl font-semibold text-foreground">
                      {getCategoryLabel(activeTab)}
                    </h2>
                    <Badge variant="secondary">{filteredContacts.length}</Badge>
                  </div>

                  <div className="space-y-3">
                    {filteredContacts.map((contact) => {
                      const isHotel = contact.origin === "hoteis";

                      if (isHotel) {
                        return (
                          <Card key={contact.id} className="hover:shadow-lg transition-shadow group border border-white/30 bg-slate-900/30">
                            <CardContent className="p-6">
                              <div className="space-y-4">
                                {/* Header with Hotel Name and City */}
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <Hotel className="h-5 w-5 text-slate-300 flex-shrink-0" />
                                      <h3 className="font-bold text-white text-lg uppercase">
                                        {contact.nome}
                                      </h3>
                                    </div>
                                    {contact.cidade && (
                                      <div className="ml-8">
                                        <p className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">
                                          📍 {contact.cidade}
                                        </p>
                                      </div>
                                    )}
                                    {contact.telefone && (
                                      <p className="text-xs text-slate-400 mt-2 ml-8">
                                        📞 {contact.telefone}
                                      </p>
                                    )}
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditContact(contact)}
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
                                          <AlertDialogTitle>Excluir hotel</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Tem certeza que deseja excluir o hotel "{contact.nome}"? Esta ação não pode ser desfeita.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteContact(contact)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Excluir
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </div>

                                {/* Address */}
                                {contact.endereco && (
                                  <div className="border-t border-white/20 pt-3">
                                    <p className="text-xs text-slate-400">
                                      <span className="text-slate-500">📍 Endereço:</span> {contact.endereco}
                                    </p>
                                  </div>
                                )}

                                {/* Prices Section */}
                                {(contact.precoSingle !== undefined && contact.precoSingle !== null) ||
                                 (contact.precoDuplo !== undefined && contact.precoDuplo !== null) ? (
                                  <div className="border-t border-white/20 pt-4">
                                    <p className="text-xs text-slate-400 mb-3 font-semibold uppercase">Diárias</p>
                                    <div className="grid grid-cols-2 gap-4">
                                      {contact.precoSingle !== undefined && contact.precoSingle !== null && (
                                        <div className="bg-slate-800/50 rounded-lg p-3 border border-cyan-500/30">
                                          <p className="text-xs text-slate-400 mb-1 font-medium">Single</p>
                                          <p className="text-lg font-bold text-cyan-400">
                                            {currencyFormatter.format(contact.precoSingle)}
                                          </p>
                                        </div>
                                      )}
                                      {contact.precoDuplo !== undefined && contact.precoDuplo !== null && (
                                        <div className="bg-slate-800/50 rounded-lg p-3 border border-cyan-500/30">
                                          <p className="text-xs text-slate-400 mb-1 font-medium">Duplo</p>
                                          <p className="text-lg font-bold text-cyan-400">
                                            {currencyFormatter.format(contact.precoDuplo)}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }
                      return (
                        <Card key={contact.id} className="hover:shadow-lg transition-shadow group">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="flex items-center gap-2">
                                  {getCategoryIcon(contact.categoria)}
                                  <div>
                                    <h3 className="font-semibold text-foreground">
                                      {contact.nome}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                      {contact.telefone && <span>{contact.telefone}</span>}
                                      {contact.email && (
                                        <>
                                          <span>•</span>
                                          <span>{contact.email}</span>
                                        </>
                                      )}
                                      {contact.origin === "clients" ? (
                                        contact.financial_contact && (
                                          <>
                                            <span>•</span>
                                            <span>{contact.financial_contact}</span>
                                          </>
                                        )
                                      ) : (
                                        <>
                                          {contact.empresa && (
                                            <>
                                              <span>•</span>
                                              <span>{contact.empresa}</span>
                                            </>
                                          )}
                                          {contact.cidade && (
                                            <>
                                              <span>•</span>
                                              <span>{contact.cidade}</span>
                                            </>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {contact.cargo && (
                                  <Badge variant="outline" className="text-xs">
                                    {contact.cargo}
                                  </Badge>
                                )}
                                {contact.origin !== "clients" && contact.origin !== "user_profiles" && (
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditContact(contact)}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-3 w-3" />
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
                                            onClick={() => handleDeleteContact(contact)}
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
                            </div>

                            {contact.observacoes && (
                              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                                <span className="font-medium">Observações:</span> {contact.observacoes}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
        </div>

        <ContactModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          contact={editingContact}
          onSave={handleSaveContact}
          onUpdate={handleUpdateContact}
        />

        <Dialog open={isHotelModalOpen} onOpenChange={setIsHotelModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingHotel ? "Editar Hotel" : "Adicionar Hotel"}</DialogTitle>
              <DialogDescription>Preencha os dados do hotel</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="hotel_nome">Nome *</Label>
                <Input id="hotel_nome" value={hotelForm.nome} onChange={(e) => setHotelForm({ ...hotelForm, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hotel_telefone">Telefone</Label>
                  <Input id="hotel_telefone" value={hotelForm.telefone} onChange={(e) => setHotelForm({ ...hotelForm, telefone: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="hotel_cidade">Cidade</Label>
                  <Input id="hotel_cidade" value={hotelForm.cidade} onChange={(e) => setHotelForm({ ...hotelForm, cidade: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="hotel_endereco">Endereço</Label>
                <Input id="hotel_endereco" value={hotelForm.endereco} onChange={(e) => setHotelForm({ ...hotelForm, endereco: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hotel_preco_single">Preço Single</Label>
                  <Input id="hotel_preco_single" type="number" step="0.01" value={hotelForm.preco_single} onChange={(e) => setHotelForm({ ...hotelForm, preco_single: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="hotel_preco_duplo">Preço Duplo</Label>
                  <Input id="hotel_preco_duplo" type="number" step="0.01" value={hotelForm.preco_duplo} onChange={(e) => setHotelForm({ ...hotelForm, preco_duplo: e.target.value })} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsHotelModalOpen(false)}>Cancelar</Button>
              <Button onClick={async () => {
                try {
                  if (!hotelForm.nome) {
                    toast({ title: "Campos obrigatórios", description: "Nome é obrigatório", variant: "destructive" });
                    return;
                  }
                  const payload = {
                    nome: hotelForm.nome,
                    telefone: hotelForm.telefone || null,
                    cidade: hotelForm.cidade || null,
                    endereco: hotelForm.endereco || null,
                    preco_single: hotelForm.preco_single !== "" ? Number(hotelForm.preco_single) : null,
                    preco_duplo: hotelForm.preco_duplo !== "" ? Number(hotelForm.preco_duplo) : null,
                  } as const;

                  if (editingHotel) {
                    const { error } = await supabase.from("hoteis").update(payload).eq("id", editingHotel.id);
                    if (error) throw error;
                    toast({ title: "Sucesso", description: "Hotel atualizado com sucesso" });
                  } else {
                    const { error } = await supabase.from("hoteis").insert(payload);
                    if (error) throw error;
                    toast({ title: "Sucesso", description: "Hotel cadastrado com sucesso" });
                  }

                  setIsHotelModalOpen(false);
                  setEditingHotel(undefined);
                  await loadContacts(searchTerm.trim() ? searchTerm : undefined);
                } catch (error) {
                  console.error("Erro ao salvar hotel:", error);
                  toast({ title: "Erro", description: "Erro ao salvar hotel", variant: "destructive" });
                }
              }}>{editingHotel ? "Atualizar" : "Cadastrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
