import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Calendar, Clock, MapPin, User, Plus, ArrowRight } from "lucide-react";
import type { FlightScheduleWithDetails } from "@/services/flightSchedules";

interface ConfirmedFlightsPromptProps {
  flights: FlightScheduleWithDetails[];
  onSelectFlight: (flight: FlightScheduleWithDetails) => void;
  onCreateNew: () => void;
}

export function ConfirmedFlightsPrompt({
  flights,
  onSelectFlight,
  onCreateNew,
}: ConfirmedFlightsPromptProps) {
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 mb-6 shadow-lg shadow-cyan-500/30">
          <Plane className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">
          Sistema de Plano de Voo
        </h1>
        <p className="text-lg text-cyan-200/80 max-w-2xl mx-auto">
          Existem <span className="text-cyan-400 font-semibold">{flights.length}</span> voos confirmados sem plano de voo.
          Deseja criar um plano para eles?
        </p>
      </div>

      {/* Flights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {flights.map((flight) => (
          <Card
            key={flight.id}
            className="bg-slate-800/50 border-slate-700/50 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer group overflow-hidden"
            onClick={() => onSelectFlight(flight)}
          >
            <CardContent className="p-0">
              {/* Card Header */}
              <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 p-4 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <Plane className="h-5 w-5 text-cyan-400" />
                    </div>
                    <span className="font-bold text-white text-lg">
                      {flight.aircraft?.registration || "N/A"}
                    </span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Confirmado
                  </Badge>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                {/* Route */}
                <div className="flex items-center gap-2 text-white">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  <span className="font-medium">{flight.origin}</span>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                  <span className="font-medium">{flight.destination}</span>
                </div>

                {/* Date & Time */}
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {flight.flight_date
                        ? new Date(flight.flight_date).toLocaleDateString("pt-BR")
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>{flight.flight_time || "N/A"}</span>
                  </div>
                </div>

                {/* Pilot */}
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <User className="h-4 w-4" />
                  <span>{flight.crew_members?.full_name || "Piloto não definido"}</span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 pb-4">
                <Button
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all"
                >
                  Criar Plano de Voo
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create New Button */}
      <div className="text-center">
        <div className="inline-block p-[1px] rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500">
          <Button
            onClick={onCreateNew}
            variant="ghost"
            className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-lg rounded-xl"
          >
            <Plus className="h-5 w-5 mr-2" />
            Criar Novo Plano de Voo
          </Button>
        </div>
        <p className="text-slate-500 text-sm mt-3">
          Criar um plano de voo sem agendamento existente
        </p>
      </div>
    </div>
  );
}
