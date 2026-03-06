import React from 'react';
import {
  X,
  Printer,
  Download,
  Save,
  Plane,
  Clock,
  Calendar,
  User,
  Wrench,
  Receipt,
  FileText,
  Link as LinkIcon
} from 'lucide-react';

interface PilotHours {
  period: string;
  josmeyr: string;
  duilio: string;
  ricardo: string;
  gramulha: string;
  oficina: string;
}

interface ServiceItem {
  description: string;
  provider: string;
  period: string;
  value: string;
  nfse: string;
}

interface OASData {
  number: string;
  registration: string;
  cellHours: string;
  mntType: string;
  periodMnt: string;
  objective: string;
  plannedDays: number;
  entryDate: string;
  exitDate: string;
  effectiveDays: number;
  flightReportFrom: string;
  flightReportTo: string;
  pilotHours: PilotHours[];
  services: ServiceItem[];
}

interface Props {
  onClose: () => void;
  onSave?: (oasNumber: string) => void;
  data?: OASData;
  oasNumber?: string;
}

const ServiceOrderDetails: React.FC<Props> = ({ onClose, onSave, data, oasNumber }) => {
  const defaultData: OASData = data || {
    number: oasNumber || "",
    registration: "",
    cellHours: "0",
    mntType: "",
    periodMnt: "",
    objective: "",
    plannedDays: 0,
    entryDate: "",
    exitDate: "",
    effectiveDays: 0,
    flightReportFrom: "",
    flightReportTo: "",
    pilotHours: [],
    services: []
  };

  const handleSave = () => {
    if (onSave) {
      onSave(defaultData.number);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl rounded-3xl shadow-2xl flex flex-col h-fit max-h-[95vh] animate-in zoom-in-95 duration-300">

        {/* Header de Ações */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-20 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Ordem de Acompanhamento de Serviço</h2>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Controle Técnico de Manutenção (OAS Nº {defaultData.number})</p>
                <div className="h-1 w-1 rounded-full bg-slate-700"></div>
                <div className="flex items-center gap-1 text-[9px] font-black text-blue-400 uppercase bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                  <LinkIcon className="w-2.5 h-2.5" /> Vinculada ao Orçamento
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors" title="Imprimir">
              <Printer className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors" title="Exportar PDF">
              <Download className="w-5 h-5" />
            </button>
            <div className="h-6 w-[1px] bg-slate-800 mx-1"></div>
            <button onClick={onClose} className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-xl text-slate-400 transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-8 overflow-y-auto custom-scrollbar">

          {/* Sessão Aeronave & Prazos */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-slate-950/50 rounded-3xl border border-slate-800 overflow-hidden text-slate-100">
              <div className="bg-yellow-500 px-4 py-2 flex justify-between items-center">
                <span className="text-slate-900 font-black text-xs uppercase tracking-tighter">Dados da Aeronave</span>
                <span className="text-slate-900 font-black text-sm">Nº {defaultData.number}</span>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Aeronave</p>
                  <p className="text-lg font-black text-blue-400">{defaultData.registration}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Horas de Célula</p>
                  <p className="text-lg font-mono font-bold">{defaultData.cellHours}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Manutenção</p>
                  <p className="text-sm font-bold text-slate-200">{defaultData.mntType}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Período/Inspeção</p>
                  <p className="text-sm font-bold text-slate-200">{defaultData.periodMnt}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Objetivo da Manut.</p>
                  <p className="text-sm text-slate-400 leading-tight">{defaultData.objective}</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 bg-slate-950/50 rounded-3xl border border-slate-800 overflow-hidden text-slate-100">
              <div className="bg-slate-800 px-4 py-2">
                <span className="text-slate-400 font-black text-xs uppercase">Prazos e Datas</span>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800/50">
                  <span className="text-xs text-slate-500">Data de Entrada:</span>
                  <span className="text-sm font-bold font-mono">{new Date(defaultData.entryDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-800/50">
                  <span className="text-xs text-slate-500">Data de Saída:</span>
                  <span className="text-sm font-bold font-mono">{new Date(defaultData.exitDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Dias Efetivos:</span>
                  <span className={`text-lg font-black ${defaultData.effectiveDays < 0 ? 'text-green-400' : 'text-slate-200'}`}>
                    {defaultData.effectiveDays} dias
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Horas por Piloto */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Clock className="w-4 h-4" /> Relatórios de Voo de {new Date(defaultData.flightReportFrom).toLocaleDateString()} até {new Date(defaultData.flightReportTo).toLocaleDateString()}
            </h3>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-slate-100">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-900 border-b border-slate-800">
                  <tr className="text-slate-500 font-black uppercase tracking-widest">
                    <th className="px-4 py-3 border-r border-slate-800">Mês / Período</th>
                    <th className="px-4 py-3 text-center border-r border-slate-800">Josmeyr</th>
                    <th className="px-4 py-3 text-center border-r border-slate-800">Duilio</th>
                    <th className="px-4 py-3 text-center border-r border-slate-800">Ricardo</th>
                    <th className="px-4 py-3 text-center border-r border-slate-800">Gramulha</th>
                    <th className="px-4 py-3 text-center">Oficina/Testes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {defaultData.pilotHours.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-4 py-3 font-bold text-slate-400 border-r border-slate-800">{row.period}</td>
                      <td className="px-4 py-3 text-center font-mono border-r border-slate-800 group-hover:text-blue-400 transition-colors">{row.josmeyr}</td>
                      <td className="px-4 py-3 text-center font-mono border-r border-slate-800 group-hover:text-blue-400 transition-colors">{row.duilio}</td>
                      <td className="px-4 py-3 text-center font-mono border-r border-slate-800 group-hover:text-blue-400 transition-colors">{row.ricardo}</td>
                      <td className="px-4 py-3 text-center font-mono border-r border-slate-800 group-hover:text-blue-400 transition-colors">{row.gramulha}</td>
                      <td className="px-4 py-3 text-center font-mono text-amber-500 font-bold">{row.oficina}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela de Serviços */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Serviços Executados e Peças
            </h3>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-yellow-500 text-slate-950 font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-3 border-r border-yellow-600/50">Descrição do Serviço</th>
                    <th className="px-4 py-3 border-r border-yellow-600/50">Fornecedor</th>
                    <th className="px-4 py-3 border-r border-yellow-600/50">Período</th>
                    <th className="px-4 py-3 border-r border-yellow-600/50 text-right">Valor</th>
                    <th className="px-4 py-3 text-center">NFSE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {defaultData.services.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-300 font-medium">{item.description}</td>
                      <td className="px-4 py-3 text-slate-400 font-bold">{item.provider}</td>
                      <td className="px-4 py-3 text-[10px] text-slate-500 uppercase">{item.period}</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-400 font-bold">R$ {item.value}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono text-[10px]">
                          {item.nfse}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Linhas vazias para preencher como no excel */}
                  {[1, 2, 3].map(n => (
                    <tr key={n} className="h-10 opacity-20">
                      <td className="px-4 py-3 border-r border-slate-900"></td>
                      <td className="px-4 py-3 border-r border-slate-900"></td>
                      <td className="px-4 py-3 border-r border-slate-900"></td>
                      <td className="px-4 py-3 border-r border-slate-900"></td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-900 border-t border-slate-800">
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-right text-xs font-black uppercase text-slate-500">Total Acumulado</td>
                    <td className="px-4 py-4 text-right text-lg font-black text-emerald-400">R$ 7.160,00</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Rodapé de Botões */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-4 rounded-b-3xl">
          <p className="text-[10px] text-slate-500 max-w-md italic">
            * Este documento é gerado automaticamente pelo SkyManager baseado nos diários de bordo e notas fiscais integradas via API de faturamento.
          </p>
          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={onClose}
              className="flex-1 md:flex-none px-6 py-2.5 rounded-xl border border-slate-800 font-bold text-slate-400 hover:bg-slate-800 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-2.5 rounded-xl shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Save className="w-4 h-4" /> Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceOrderDetails;
