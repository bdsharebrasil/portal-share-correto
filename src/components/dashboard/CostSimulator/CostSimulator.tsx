import { useState } from "react";
import { CalculatorProvider } from "./context";
import { MainView } from "./MainView";
import { AircraftSelectView } from "./AircraftSelectView";
import { AirportSearchView } from "./AirportSearchView";
import { ResultsView } from "./ResultsView";
import type { FlightCosts } from "./utils";

type Step =
  | { name: "main" }
  | { name: "aircraft" }
  | { name: "airport"; mode: "adep" | "ades" }
  | { name: "results"; costs: FlightCosts };

function SimulatorInner() {
  const [step, setStep] = useState<Step>({ name: "main" });
  const goHome = () => setStep({ name: "main" });

  switch (step.name) {
    case "aircraft":
      return <AircraftSelectView onBack={goHome} />;
    case "airport":
      return <AirportSearchView mode={step.mode} onBack={goHome} />;
    case "results":
      return <ResultsView costs={step.costs} onBack={goHome} />;
    default:
      return (
        <MainView
          onSelectAircraft={() => setStep({ name: "aircraft" })}
          onSelectAirport={(mode) => setStep({ name: "airport", mode })}
          onViewResults={(costs) => setStep({ name: "results", costs })}
        />
      );
  }
}

export function CostSimulator() {
  return (
    <CalculatorProvider>
      <SimulatorInner />
    </CalculatorProvider>
  );
}
