import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface FlightDurationInputProps {
  value: string; // stored as decimal hours string (e.g., "2.5")
  onChange: (value: string) => void; // output as decimal hours string
  label?: string;
}

/**
 * Component to input flight duration as separate HH and MM fields
 * Converts to/from decimal hours internally
 */
export function FlightDurationInput({
  value,
  onChange,
  label = "Duração do Voo"
}: FlightDurationInputProps) {
  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('00');

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

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');

    // Limit to 2 digits
    if (val.length > 2) {
      val = val.slice(0, 2);
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
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            type="text"
            inputMode="numeric"
            value={hours}
            onChange={handleHoursChange}
            placeholder="00"
            maxLength={2}
            className="text-center font-mono"
          />
          <p className="text-xs text-muted-foreground text-center mt-1">Horas</p>
        </div>
        <div className="flex items-center justify-center pt-4">
          <span className="text-2xl font-bold text-muted-foreground">:</span>
        </div>
        <div className="flex-1">
          <Input
            type="text"
            inputMode="numeric"
            value={minutes}
            onChange={handleMinutesChange}
            placeholder="00"
            maxLength={2}
            className="text-center font-mono"
          />
          <p className="text-xs text-muted-foreground text-center mt-1">Minutos</p>
        </div>
      </div>
    </div>
  );
}
