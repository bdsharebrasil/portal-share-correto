import React, { useState, useEffect } from 'react';
import { useCallback } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, ChevronDown, ChevronUp, User, Copy, AlertCircle} from 'lucide-react';
import { useCTMBudgetTracking, BudgetVersion } from '@/hooks/useCTMBudgetTracking';
import { toast } from 'sonner';

interface CTMBudgetHistoryProps {
  budgetId: string;
}

export function CTMBudgetHistory({ budgetId }: CTMBudgetHistoryProps) {
  const { getBudgetHistory } = useCTMBudgetTracking();
  const [versions, setVersions] = useState<BudgetVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<{ v1?: BudgetVersion; v2?: BudgetVersion }>({});

  useEffect(() => {
    loadHistory();
  }, [budgetId]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const data = await getBudgetHistory(budgetId);
    setVersions(data);
    setLoading(false);
  }, [budgetId, getBudgetHistory]);

  const handleExpandVersion = (versionId: string) => {
    setExpandedVersion(expandedVersion === versionId ? null : versionId);
  };

  const handleCopyData = (data: any) => {
    const jsonStr = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonStr);
    toast.success('Dados copiados');
  };

  const formatFieldName = (field: string) => {
    const fieldNames: Record<string, string> = {
      titulo: 'Título',
      descricao: 'Descrição',
      status: 'Status',
      total_estimado: 'Total Estimado',
      data_criacao: 'Data Criação',
      observacoes: 'Observações',
    };
    return fieldNames[field] || field;
  };

  if (loading) {
    return (
      <Card className="bg-slate-800/40 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan-400" />
            Histórico de Versões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (versions.length === 0) {
    return (
      <Card className="bg-slate-800/40 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan-400" />
            Histórico de Versões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-slate-600 mb-4" />
            <p className="text-slate-400 mb-1">Nenhuma versão registrada</p>
            <p className="text-xs text-slate-500">As versões serão exibidas conforme o orçamento for atualizado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-slate-800/40 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan-400" />
            Histórico de Versões ({versions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {versions.map((version, index) => (
            <div
              key={version.id}
              className="border border-white/5 rounded-lg overflow-hidden bg-slate-800/20 hover:bg-slate-800/40 transition-colors"
            >
              {/* Header */}
              <button
                onClick={() => handleExpandVersion(version.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/2 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  {expandedVersion === version.id ? (
                    <ChevronUp className="h-4 w-4 text-cyan-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-cyan-500/10 text-cyan-300 px-2 py-1 rounded">
                        v{version.version}
                      </span>
                      {index === 0 && (
                        <Badge variant="default" className="bg-green-500/20 text-green-100 border-green-500/30">
                          Atual
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {format(new Date(version.changed_at || (version as any).created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                    </p>
                  </div>
                </div>
                {version.changed_by && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <User className="h-3 w-3" />
                    <span>{version.changed_by}</span>
                  </div>
                )}
              </button>

              {/* Expanded Content */}
              {expandedVersion === version.id && (
                <div className="border-t border-white/5 px-4 py-4 space-y-4">
                  {/* Changed Fields */}
                  {version.changed_fields && Object.keys(version.changed_fields).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                        Campos Alterados
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(version.changed_fields).map(([field, value]) => (
                          <div key={field} className="bg-white/3 rounded px-3 py-2 text-xs">
                            <span className="text-slate-400">{formatFieldName(field)}:</span>{' '}
                            <span className="text-cyan-300 font-mono">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Data Snapshot */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                      Snapshot Completo
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/2">
                            <th className="text-left px-3 py-2 text-slate-500 font-medium">Campo</th>
                            <th className="text-left px-3 py-2 text-slate-500 font-medium">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(version.data || {}).map(([field, value]) => (
                            <tr key={field} className="border-b border-white/3 hover:bg-white/1">
                              <td className="px-3 py-2 text-slate-400">{formatFieldName(field)}</td>
                              <td className="px-3 py-2 text-slate-200 font-mono">
                                {typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' : String(value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 h-8 text-xs"
                      onClick={() => handleCopyData(version.data)}
                    >
                      <Copy className="h-3 w-3" />
                      Copiar JSON
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
