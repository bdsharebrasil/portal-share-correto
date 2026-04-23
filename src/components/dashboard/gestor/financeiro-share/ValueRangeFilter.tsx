import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

interface ValueRangeFilterProps {
  min: number;
  max: number;
  step?: number;
  onRangeChange: (min: number, max: number) => void;
  disabled?: boolean;
}

export const ValueRangeFilter = ({
  min,
  max,
  step = 100,
  onRangeChange,
  disabled = false,
}: ValueRangeFilterProps) => {
  const [values, setValues] = useState<[number, number]>([min, max]);

  const handleRangeChange = (newValues: number[]) => {
    const [minVal, maxVal] = newValues as [number, number];
    setValues([minVal, maxVal]);
    onRangeChange(minVal, maxVal);
  };

  const handleMinInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = Math.min(Number(e.target.value) || 0, values[1]);
    setValues([newMin, values[1]]);
    onRangeChange(newMin, values[1]);
  };

  const handleMaxInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = Math.max(Number(e.target.value) || 0, values[0]);
    setValues([values[0], newMax]);
    onRangeChange(values[0], newMax);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Intervalo de Valores</Label>
        <Slider
          value={values}
          onValueChange={handleRangeChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-foreground/70">
            Mínimo
          </Label>
          <Input
            type="number"
            value={values[0]}
            onChange={handleMinInput}
            disabled={disabled}
            className="bg-background/50 border-border/60 text-foreground text-sm"
            placeholder="Min"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-foreground/70">
            Máximo
          </Label>
          <Input
            type="number"
            value={values[1]}
            onChange={handleMaxInput}
            disabled={disabled}
            className="bg-background/50 border-border/60 text-foreground text-sm"
            placeholder="Max"
          />
        </div>
      </div>

      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
        <p className="text-sm text-foreground/80">
          <span className="text-xs uppercase tracking-wider text-foreground/60 block mb-1">
            Intervalo Selecionado
          </span>
          <span className="font-semibold text-foreground">
            R${" "}
            {values[0].toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}{" "}
            -{" "}
            R${" "}
            {values[1].toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
          </span>
        </p>
      </div>
    </motion.div>
  );
};
