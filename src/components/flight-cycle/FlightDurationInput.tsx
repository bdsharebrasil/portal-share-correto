import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

interface FlightDurationInputProps {
  value: string; // stored as decimal hours string (e.g., "2.5")
  onChange: (value: string) => void; // output as decimal hours string
  label?: string;
}

/**
 * Component to input flight duration as separate HH and MM fields
 * Converts to/from decimal hours internally
 * Supports visual time picker for Zulu time
 */
export function FlightDurationInput({
  value,
  onChange,
  label = "Duração do Voo (Zulu Time)"
}: FlightDurationInputProps) {
  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('00');
  const [hoursOpen, setHoursOpen] = useState(false);
  const [minutesOpen, setMinutesOpen] = useState(false);

  // Initialize hours and minutes from the decimal value
  useEffect(() => {
    if (value) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        const wholeHours = Math.floor(numValue);
        const mins = Math.round((numValue - wholeHours) * 60);
        setHours(String(wholeHours).padStart(2, '0'));
        setMinutes(String(mins).padStart(2, '0'));
      }
    } else {
      setHours('00');
      setMinutes('00');
    }
  }, [value]);

  const handleHourSelect = (h: number) => {
    const newHours = String(h).padStart(2, '0');
    setHours(newHours);
    updateValue(newHours, minutes);
    setHoursOpen(false);
  };

  const handleMinuteSelect = (m: number) => {
    const newMinutes = String(m).padStart(2, '0');
    setMinutes(newMinutes);
    updateValue(hours, newMinutes);
    setMinutesOpen(false);
  };

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');

    // Limit to 2 digits and max 23 (Zulu time)
    if (val.length > 2) {
      val = val.slice(0, 2);
    }

    const numVal = parseInt(val || '0', 10);
    if (numVal > 23) {
      val = '23';
    }

    // Pad with zero if needed
    if (val === '') {
      val = '00';
    } else if (val.length === 1) {
      val = val.padStart(2, '0');
    }

    setHours(val);
    updateValue(val, minutes);
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');

    // Limit to 2 digits and max 59
    if (val.length > 2) {
      val = val.slice(0, 2);
    }

    const numVal = parseInt(val || '0', 10);
    if (numVal > 59) {
      val = '59';
    }

    // Pad with zero if needed
    if (val === '') {
      val = '00';
    } else if (val.length === 1) {
      val = val.padStart(2, '0');
    }

    setMinutes(val);
    updateValue(hours, val);
  };

  const updateValue = (h: string, m: string) => {
    const numHours = parseInt(h || '0', 10);
    const numMinutes = parseInt(m || '0', 10);
    const decimalHours = numHours + (numMinutes / 60);
    onChange(decimalHours.toString());
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <label className="text-sm font-medium text-foreground">{label}</label>
      </div>
      <div className="flex items-center gap-2">
        {/* Hours Picker */}
        <Popover open={hoursOpen} onOpenChange={setHoursOpen}>
          <PopoverTrigger asChild>
            <Input
              type="number"
              min="0"
              max="23"
              value={hours}
              onChange={handleHoursChange}
              placeholder="00"
              className="text-center font-mono cursor-pointer"
              readOnly={false}
            />
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3">
            <div className="text-xs font-semibold mb-2 text-muted-foreground">Selecione a Hora (Zulu)</div>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 24 }, (_, i) => (
                <Button
                  key={i}
                  variant={hours === String(i).padStart(2, '0') ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleHourSelect(i)}
                >
                  {String(i).padStart(2, '0')}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center justify-center">
          <span className="text-2xl font-bold text-muted-foreground">:</span>
        </div>

        {/* Minutes Picker */}
        <Popover open={minutesOpen} onOpenChange={setMinutesOpen}>
          <PopoverTrigger asChild>
            <Input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={handleMinutesChange}
              placeholder="00"
              className="text-center font-mono cursor-pointer"
              readOnly={false}
            />
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3">
            <div className="text-xs font-semibold mb-2 text-muted-foreground">Selecione os Minutos</div>
            <div className="grid grid-cols-6 gap-1">
              {Array.from({ length: 60 }, (_, i) => (
                <Button
                  key={i}
                  variant={minutes === String(i).padStart(2, '0') ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleMinuteSelect(i)}
                >
                  {String(i).padStart(2, '0')}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="text-xs text-muted-foreground">
          (Z)
        </div>
      </div>
    </div>
  );
}
