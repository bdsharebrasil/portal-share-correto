import { useState } from "react";
import { FileText, Plus, Eye, Edit, Trash2, Download, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInvoices, useCreateInvoice, useAccountsReceivable } from "@/hooks/use-invoice-data";
import { formatCurrency, formatDate } from "@/lib/receiptUtils";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Invoices() {
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  
  const { data: invoices = [] } = useInvoices();
  const { data: accountsReceivable = [] } = useAccountsReceivable();
  const createInvoice = useCreateInvoice();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    clientName: "",
    clientDocument: "",
    clientEmail: "",
    clientAddress: "",
    serviceDescription: "",
    value: "",
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    observations: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clientName || !formData.serviceDescription || !formData.value || !formData.issueDate) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createInvoice.mutateAsync({
        ...formData,
        value: formData.value,
        issueDate: new Date(formData.issueDate),
        dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
      });

      toast({
        title: "Sucesso",
        description: "Nota fiscal emitida com sucesso! Conta a receber criada automaticamente.",
      });

      setFormData({
        clientName: "",
        clientDocument: "",
        clientEmail: "",
        clientAddress: "",
        serviceDescription: "",
        value: "",
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: "",
        observations: "",
      });
      
      setIsCreateInvoiceOpen(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao emitir nota fiscal. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "issued":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Emitida</Badge>;
      case "paid":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Paga</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">Cancelada</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  const issuedCount = invoices.filter(i => i.situacao === 'issued').length;
  const paidCount = invoices.filter(i => i.situacao === 'paid').length;
  const totalValue = invoices.reduce((sum, i) => sum + parseFloat(i.value || "0"), 0);
  const openReceivables = accountsReceivable.filter(r => r.situacao === 'open').length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
                <FileText className="h-8 w-8 mr-3 text-blue-400" />
                Emissão de Nota Fiscal
              </h1>
              <p className="text-blue-100">Crie e gerencie suas notas fiscais e despesas para ressarcimento</p>
            </div>
            <Button 
              onClick={() => setIsCreateInvoiceOpen(true)}
              className="btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Nota Fiscal
            </Button>
          </div>
        </div>

        {/* Quick Access */}
        <div className="modern-card p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Acesso Rápido aos Sites de Emissão</h3>
          <div className="flex flex-wrap gap-4">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => window.open('https://nfe.prefeitura.sp.gov.br/', '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              NF-e Várzea Grande
            </Button>
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => window.open('https://www.nfse.gov.br/', '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              e-SNFS
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="modern-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Notas Emitidas</p>
                <p className="text-2xl font-bold text-blue-400">{issuedCount}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          
          <div className="modern-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Notas Pagas</p>
                <p className="text-2xl font-bold text-green-400">{paidCount}</p>
              </div>
              <FileText className="h-8 w-8 text-green-400" />
            </div>
          </div>
          
          <div className="modern-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Valor Total</p>
                <p className="text-2xl font-bold text-blue-400">{formatCurrency(totalValue)}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          
          <div className="modern-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Contas em Aberto</p>
                <p className="text-2xl font-bold text-yellow-400">{openReceivables}</p>
              </div>
              <FileText className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="modern-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Notas Fiscais Emitidas</h3>
          <div className="overflow-x-auto">
            <Table className="modern-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-gray-300">Número</TableHead>
                  <TableHead className="text-gray-300">Cliente</TableHead>
                  <TableHead className="text-gray-300">Descrição</TableHead>
                  <TableHead className="text-gray-300">Valor</TableHead>
                  <TableHead className="text-gray-300">Data Emissão</TableHead>
                  <TableHead className="text-gray-300">Vencimento</TableHead>
                  <TableHead className="text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-300 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Nenhuma nota fiscal emitida ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="text-gray-200 font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell className="text-gray-200">{invoice.clientName}</TableCell>
                      <TableCell className="text-gray-200">{invoice.serviceDescription.substring(0, 50)}...</TableCell>
                      <TableCell className="text-gray-200 font-medium">{formatCurrency(parseFloat(invoice.value || "0"))}</TableCell>
                      <TableCell className="text-gray-200">{formatDate(invoice.issueDate)}</TableCell>
                      <TableCell className="text-gray-200">{invoice.dueDate ? formatDate(invoice.dueDate) : "-"}</TableCell>
                      <TableCell>{getStatusBadge(invoice.situacao || "issued")}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedInvoice(invoice)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          {invoice.pdfUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(invoice.pdfUrl, '_blank')}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Create Invoice Form - Inline */}
        {isCreateInvoiceOpen && (
          <Card className="bg-card border-border/50 border-primary/50 bg-primary/5 mb-6">
            <CardHeader className="pb-4 pt-6 px-6 border-b border-border/50">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-semibold">Criar Nova Nota Fiscal / Despesa de Ressarcimento</CardTitle>
                <Button
                  variant="ghost"
                  onClick={() => setIsCreateInvoiceOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Cliente *</Label>
                  <Input
                    id="clientName"
                    placeholder="Nome do cliente"
                    value={formData.clientName}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientDocument">CPF/CNPJ</Label>
                  <Input
                    id="clientDocument"
                    placeholder="000.000.000-00"
                    value={formData.clientDocument}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientDocument: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    placeholder="cliente@exemplo.com"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value">Valor (R$) *</Label>
                  <Input
                    id="value"
                    type="number"
                    placeholder="1000.00"
                    step="0.01"
                    min="0"
                    value={formData.value}
                    onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="issueDate">Data de Emissão *</Label>
                  <Input
                    id="issueDate"
                    type="data"
                    value={formData.issueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Data de Vencimento</Label>
                  <Input
                    id="dueDate"
                    type="data"
                    value={formData.dueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientAddress">Endereço do Cliente</Label>
                <Textarea
                  id="clientAddress"
                  placeholder="Endereço completo do cliente..."
                  value={formData.clientAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, clientAddress: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceDescription">Descrição do Serviço / Despesa *</Label>
                <Textarea
                  id="serviceDescription"
                  placeholder="Descreva detalhadamente o serviço prestado ou despesa..."
                  value={formData.serviceDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceDescription: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações adicionais..."
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateInvoiceOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="btn-primary flex-1" disabled={createInvoice.isPending}>
                  {createInvoice.isPending ? "Emitindo..." : "Emitir Nota Fiscal"}
                </Button>
              </div>
            </form>
            </CardContent>
          </Card>
        )}

        {/* View Invoice Modal */}
        {selectedInvoice && (
          <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Detalhes da Nota Fiscal - {selectedInvoice.invoiceNumber}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Cliente</Label>
                    <p className="text-white">{selectedInvoice.clientName}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400">CPF/CNPJ</Label>
                    <p className="text-white">{selectedInvoice.clientDocument || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400">Email</Label>
                    <p className="text-white">{selectedInvoice.clientEmail || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400">Valor</Label>
                    <p className="text-white font-bold">{formatCurrency(parseFloat(selectedInvoice.value))}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400">Data de Emissão</Label>
                    <p className="text-white">{formatDate(selectedInvoice.issueDate)}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400">Vencimento</Label>
                    <p className="text-white">{selectedInvoice.dueDate ? formatDate(selectedInvoice.dueDate) : "-"}</p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-gray-400">Endereço</Label>
                  <p className="text-white">{selectedInvoice.clientAddress || "-"}</p>
                </div>
                
                <div>
                  <Label className="text-gray-400">Descrição do Serviço</Label>
                  <p className="text-white">{selectedInvoice.serviceDescription}</p>
                </div>
                
                {selectedInvoice.observacoes && (
                  <div>
                    <Label className="text-gray-400">Observações</Label>
                    <p className="text-white">{selectedInvoice.observacoes}</p>
                  </div>
                )}
                
                <div className="flex justify-between items-center pt-4">
                  <div>
                    <Label className="text-gray-400">Status</Label>
                    <div className="mt-1">
                      {getStatusBadge(selectedInvoice.situacao)}
                    </div>
                  </div>
                  <Button onClick={() => setSelectedInvoice(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}
