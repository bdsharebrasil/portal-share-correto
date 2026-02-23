import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane } from "lucide-react";

interface ClientAircraft {
  aircraft_id: string;
  share_percentage: number;
  aircraft: {
    id: string;
    registration: string;
    manufacturer: string;
    model: string;
    year: string;
  };
}

interface AircraftSelectorProps {
  aircrafts: ClientAircraft[];
  selectedAircraftId: string;
  onSelect: (aircraft: ClientAircraft) => void;
  children?: React.ReactNode;
}

export function AircraftSelector({
  aircrafts,
  selectedAircraftId,
  onSelect,
  children
}: AircraftSelectorProps) {
  if (aircrafts.length <= 1) {
    return <>{children}</>;
  }

  return (
    <Tabs defaultValue={selectedAircraftId} onValueChange={(value) => {
      const selected = aircrafts.find(a => a.aircraft_id === value);
      if (selected) onSelect(selected);
    }}>
      <TabsList className="w-full border-b border-border bg-transparent rounded-none p-0 h-auto gap-2 flex-wrap md:flex-nowrap px-0">
        {aircrafts.map((aircraft) => (
          <TabsTrigger
            key={aircraft.aircraft_id}
            value={aircraft.aircraft_id}
            className="gap-2 data-[state=active]:border-b-2 data-[state=active]:bg-transparent rounded-none border-b-2 border-transparent px-4 py-3"
          >
            <Plane className="h-4 w-4" />
            <span>{aircraft.aircraft.registration}</span>
            <Badge variant="secondary" className="text-xs">
              {aircraft.share_percentage}%
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>

      {aircrafts.map((aircraft) => (
        <TabsContent key={aircraft.aircraft_id} value={aircraft.aircraft_id} className="mt-6">
          {children}
        </TabsContent>
      ))}
    </Tabs>
  );
}
