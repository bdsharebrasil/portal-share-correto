import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  type Solicitacao,
  useAgendamentoMutations,
} from "@/hooks/useAgendamentoVoo";

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovaPernaDialog({
  voo,
  open,
  onOpenChange,
}: Props) {
  const {
    adicionarPerna,
  } = useAgendamentoMutations();

  const [
    dataPerna,
    setDataPerna,
  ] = useState("");

  const [origem, setOrigem] =
    useState("");

  const [destino, setDestino] =
    useState("");

  const submit = () => {
    if (
      !voo ||
      !dataPerna ||
      !origem ||
      !destino
    ) {
      return;
    }

    adicionarPerna.mutate(
      {
        solicitacao: voo,
        dataPerna,
        origem,
        destino,
        qtdPassageiros:
          voo.qtd_passageiros ?? 1,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  useEffect(() => {
    if (!open || !voo) return;

    setDataPerna(
      voo.data_partida ??
        voo.data_agendada,
    );

    setOrigem(
      voo.destino ??
        voo.origem ??
        "",
    );

    setDestino(
      voo.origem ??
        "",
    );
  }, [open, voo]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-md">

        <DialogHeader>
          <DialogTitle>
            Adicionar nova perna
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">

          <div className="space-y-2">
            <Label>
              Data da perna
            </Label>

            <Input
              type="date"
              value={dataPerna}
              onChange={(e) =>
                setDataPerna(
                  e.target.value,
                )
              }
            />
          </div>

          <div className="space-y-2">
            <Label>
              Origem
            </Label>

            <Input
              value={origem}
              onChange={(e) =>
                setOrigem(
                  e.target.value.toUpperCase(),
                )
              }
              placeholder="SBCY"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Destino
            </Label>

            <Input
              value={destino}
              onChange={(e) =>
                setDestino(
                  e.target.value.toUpperCase(),
                )
              }
              placeholder="SBGR"
            />
          </div>

        </div>

        <DialogFooter>

          <Button
            variant="outline"
            onClick={() =>
              onOpenChange(false)
            }
          >
            Cancelar
          </Button>

          <Button
            onClick={submit}
            disabled={
              adicionarPerna.isPending ||
              !dataPerna ||
              !origem ||
              !destino
            }
          >
            {adicionarPerna.isPending
              ? "Criando..."
              : "Criar perna"}
          </Button>

        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
