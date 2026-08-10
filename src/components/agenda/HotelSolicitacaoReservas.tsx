import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  BedDouble, CalendarDays, CheckCircle2, Hotel as HotelIcon, Loader2, Mail, Send, TriangleAlert, Users,
} from 'lucide-react'

const FIELD =
  'bg-slate-950/60 border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 ' +
  'focus-visible:border-cyan-500/60 focus-visible:ring-1 focus-visible:ring-cyan-500/30'
const LABEL = 'text-slate-300 font-medium mb-1.5 block text-xs'

interface Hotel {
  id: string
  nome: string
  cidade?: string | null
  uf?: string | null
  email?: string | null
  email_reservas?: string | null
}

interface Props {
  hotel: Hotel
  userId?: string
  open?: boolean
  onClose: () => void
}

const EMPTY_FORM = {
  dataCheckin: '',
  dataCheckout: '',
  tipoQuarto: '',
  quantidadeHospedes: 1,
  hospedeNome: '',
  hospedeTelefone: '',
  hospedeEmail: '',
  observacoes: '',
}

export function HotelSolicitacaoReservas({ hotel, userId, open = true, onClose }: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setStatus('idle')
      setErrorMsg('')
    }
  }, [open, hotel.id])

  const hoje = new Date().toISOString().split('T')[0]
  const destino = [hotel.cidade, hotel.uf].filter(Boolean).join(' / ')
  const emailDestino = hotel.email_reservas || hotel.email
  const semEmailReservas = !emailDestino

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (form.dataCheckout <= form.dataCheckin) {
      setErrorMsg('A data de checkout deve ser posterior ao check-in')
      setStatus('error')
      return
    }

    setStatus('sending')
    setErrorMsg('')

    try {
      const res = await fetch('https://api-workers.sharebrasil.com/api/hotel-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId: hotel.id, userId, ...form }),
      })

      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error ?? 'Erro desconhecido')
        setStatus('error')
        return
      }
      if (json.warning) {
        setErrorMsg(json.warning)
        setStatus('error')
        return
      }
      setStatus('sent')
    } catch {
      setErrorMsg('Falha de conexão')
      setStatus('error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-2xl overflow-y-auto border-slate-800 bg-slate-900/95 backdrop-blur">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10">
              <HotelIcon className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-slate-100">Solicitar reserva</DialogTitle>
              <DialogDescription className="text-slate-400">
                {hotel.nome}
                {destino ? ` · ${destino}` : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {semEmailReservas ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            <TriangleAlert className="h-5 w-5 shrink-0" />
            Este hotel não possui e-mail cadastrado para reservas.
          </div>
        ) : status === 'sent' ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-slate-100">Solicitação enviada para {hotel.nome}</p>
            <p className="text-xs text-slate-400">Enviada para {emailDestino}. Aguarde a confirmação do hotel.</p>
            <Button className="mt-2 bg-cyan-600 hover:bg-cyan-500" onClick={onClose}>Fechar</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-1.5 text-[11px] text-slate-400">
              <Mail className="h-3.5 w-3.5 text-cyan-400" /> {emailDestino}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className={LABEL}><CalendarDays className="mr-1 inline h-3 w-3" /> Check-in *</Label>
                <Input
                  type="date"
                  required
                  min={hoje}
                  className={FIELD}
                  value={form.dataCheckin}
                  onChange={(e) => setForm({ ...form, dataCheckin: e.target.value })}
                />
              </div>
              <div>
                <Label className={LABEL}><CalendarDays className="mr-1 inline h-3 w-3" /> Check-out *</Label>
                <Input
                  type="date"
                  required
                  min={form.dataCheckin || hoje}
                  className={FIELD}
                  value={form.dataCheckout}
                  onChange={(e) => setForm({ ...form, dataCheckout: e.target.value })}
                />
              </div>

              <div>
                <Label className={LABEL}><BedDouble className="mr-1 inline h-3 w-3" /> Tipo de quarto</Label>
                <Select value={form.tipoQuarto} onValueChange={(v) => setForm({ ...form, tipoQuarto: v })}>
                  <SelectTrigger className={FIELD}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="duplo">Duplo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={LABEL}><Users className="mr-1 inline h-3 w-3" /> Nº de hóspedes</Label>
                <Input
                  type="number"
                  min={1}
                  className={FIELD}
                  value={form.quantidadeHospedes}
                  onChange={(e) => setForm({ ...form, quantidadeHospedes: Number(e.target.value) })}
                />
              </div>

              <div className="sm:col-span-2">
                <Label className={LABEL}>Nome do hóspede *</Label>
                <Input
                  required
                  maxLength={120}
                  className={FIELD}
                  value={form.hospedeNome}
                  onChange={(e) => setForm({ ...form, hospedeNome: e.target.value })}
                />
              </div>

              <div>
                <Label className={LABEL}>Telefone *</Label>
                <Input
                  required
                  maxLength={30}
                  className={FIELD}
                  value={form.hospedeTelefone}
                  onChange={(e) => setForm({ ...form, hospedeTelefone: e.target.value })}
                />
              </div>
              <div>
                <Label className={LABEL}>E-mail do hóspede</Label>
                <Input
                  type="email"
                  maxLength={255}
                  className={FIELD}
                  value={form.hospedeEmail}
                  onChange={(e) => setForm({ ...form, hospedeEmail: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2">
                <Label className={LABEL}>Observações</Label>
                <Textarea
                  rows={3}
                  maxLength={1000}
                  className={FIELD}
                  placeholder="Preferências, horário de chegada, faturamento..."
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
            </div>

            {status === 'error' && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                <TriangleAlert className="h-4 w-4 shrink-0" /> {errorMsg}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button
                type="submit"
                disabled={status === 'sending'}
                className="gap-1.5 bg-cyan-600 hover:bg-cyan-500"
              >
                {status === 'sending'
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                  : <><Send className="h-4 w-4" /> Enviar solicitação</>}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
