import { Card, CardContent } from "@/components/ui/card";

interface ClientDataDisplayProps {
  nome: string;
  documento?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
}

export function ClientDataDisplay({
  nome,
  documento,
  endereco,
  cidade,
  uf,
}: ClientDataDisplayProps) {
  // Se nenhum dados, não exibir
  if (!nome) {
    return null;
  }

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="p-6 space-y-6">
        {/* Nome da Empresa e CNPJ/CPF */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-white mb-3 block">
              Nome da Empresa <span className="text-red-500">*</span>
            </label>
            <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white">
              {nome}
            </div>
          </div>
          {documento && (
            <div>
              <label className="text-sm font-medium text-white mb-3 block">
                CNPJ/CPF
              </label>
              <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white">
                {documento}
              </div>
            </div>
          )}
        </div>

        {/* Endereço */}
        {endereco && (
          <div>
            <label className="text-sm font-medium text-white mb-3 block">
              Endereço
            </label>
            <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white">
              {endereco}
            </div>
          </div>
        )}

        {/* Cidade e UF */}
        {(cidade || uf) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cidade && (
              <div>
                <label className="text-sm font-medium text-white mb-3 block">
                  Cidade
                </label>
                <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white">
                  {cidade}
                </div>
              </div>
            )}
            {uf && (
              <div>
                <label className="text-sm font-medium text-white mb-3 block">
                  UF
                </label>
                <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white">
                  {uf}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
