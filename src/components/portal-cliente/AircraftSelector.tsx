import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane } from "lucide-react";

interface ClientAircraft {
  aeronave_id: string;
  id_aeronave: string;
  percentual_sociedade: number;
  percentual_participacao?: number;
  aeronave: {
    id: string;
    registration?: string;
    matricula?: string;
    manufacturer?: string;
    fabricante?: string;
    model?: string;
    modelo?: string;
    year?: string;
    ano?: string;
  };
}

interface AeronaveSelectorProps {
  aircrafts: ClientAircraft[];
  selectedAircraftId: string;
  onSelect: (aircraft: ClientAircraft) => void;
  children?: React.ReactNode;
}

export function AeronaveSelector({
  aircrafts,
  selectedAircraftId,
  onSelect,
  children
}: AeronaveSelectorProps) {
  if (aircrafts.length <= 1) {
    return <>{children}</>;
  }

  return (
    <>
      <style>{`
        .aeronave-tab[data-state="active"] {
          background-color: rgba(12, 158, 31, 0.1) !important;
          border-color: rgba(3, 117, 43, 1) !important;
        }
        .aeronave-tab:hover {
          border-color: rgba(3, 117, 43, 0.5) !important;
        }
      `}</style>
      <Tabs defaultValue={selectedAircraftId} onValueChange={(value) => {
        const selected = aircrafts.find(a => a.aeronave_id === value);
        if (selected) onSelect(selected);
      }}>
        <TabsList className="w-full bg-transparent rounded-none p-0 h-auto gap-3 flex-wrap md:flex-nowrap px-0 border-b border-border">
          {aircrafts.map((aircraft) => (
            <TabsTrigger
              key={aircraft.aeronave_id}
              value={aircraft.aeronave_id}
              className="aircraft-tab gap-2 px-4 py-3 rounded-lg border-2 border-transparent transition-all"
            >
              <Plane className="h-4 w-4" />
              <span>{aircraft.aeronave?.matricula || aircraft.aeronave?.registration || '-'}</span>
              <Badge variant="secondary" className="text-xs">
                {(aircraft.percentual_participacao || aircraft.percentual_sociedade || 0)}%
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {aircrafts.map((aircraft) => (
          <TabsContent key={aircraft.aeronave_id} value={aircraft.aeronave_id} className="mt-6">
            {children}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
