import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, Plane, FileText, Cloud, MapPin, ClipboardCheck } from "lucide-react";
import { StepIndicator } from "./StepIndicator";
import { Step1AircraftInfo } from "./steps/Step1AircraftInfo";
import { Step2FlightRules } from "./steps/Step2FlightRules";
import { Step3Route } from "./steps/Step3Route";
import { Step4Weather } from "./steps/Step4Weather";
import { Step5Checklist } from "./steps/Step5Checklist";
import { Step6Summary } from "./steps/Step6Summary";
import type { FlightScheduleWithDetails } from "@/services/flightSchedules";
import { toast } from "sonner";

interface FlightPlanWizardProps {
  selectedFlight: FlightScheduleWithDetails | null;
  onBack: () => void;
  onComplete?: (flightPlan: FlightPlanData) => void;
  onStep1Complete?: (flightPlan: FlightPlanData) => void;
  initialFormData?: FlightPlanData;
  initialStep?: number;
}

export interface FlightPlanData {
  // Step 1 - Aircraft
  aircraftRegistration: string;
  aircraftType: string;
  aircraftId: string;
  // Step 2 - Flight Rules
  flightRules: string;
  flightType: string;
  numberOfAircraft: string;
  wakeCategory: string;
  equipment: string;
  transponder: string;
  // Step 3 - Route
  departureAirport: string;
  departureTime: string;
  cruiseSpeed: string;
  cruiseAltitude: string;
  route: string;
  destinationAirport: string;
  estimatedTime: string;
  alternateAirport: string;
  fuelEndurance: string;
  // Step 4 - Weather (fetched)
  departureMetar: string;
  departureTaf: string;
  destinationMetar: string;
  destinationTaf: string;
  // Step 5 - Checklist
  checklistItems: Record<string, boolean>;
  // Additional
  pilotInCommand: string;
  pilotId: string;
  clientName: string;
  clientId: string;
  remarks: string;
}

const STEPS = [
  { id: 1, title: "Aeronave", icon: Plane },
  { id: 2, title: "Regras de Voo", icon: FileText },
  { id: 3, title: "Rota", icon: MapPin },
  { id: 4, title: "Meteorologia", icon: Cloud },
  { id: 5, title: "Checklist", icon: ClipboardCheck },
  { id: 6, title: "Resumo", icon: Check },
];

export function FlightPlanWizard({ selectedFlight, onBack, onComplete, onStep1Complete, initialFormData, initialStep }: FlightPlanWizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep || 1);
  const [formData, setFormData] = useState<FlightPlanData>(() => {
    // If initial form data is provided, use it instead of creating new
    if (initialFormData) {
      return initialFormData;
    }

    return {
      // Pre-fill from selected flight if available
      aircraftRegistration: selectedFlight?.aircraft?.registration || "",
      aircraftType: selectedFlight?.aircraft?.model || "",
      aircraftId: selectedFlight?.aircraft_id || "",
      flightRules: "I",
      flightType: "N",
      numberOfAircraft: "1",
      wakeCategory: "L",
      equipment: "SDFGHIRY",
      transponder: "LB1",
      departureAirport: selectedFlight?.origin || "",
      departureTime: selectedFlight?.flight_time?.replace(":", "") || "",
      cruiseSpeed: "N0250",
      cruiseAltitude: "A085",
      route: "DCT",
      destinationAirport: selectedFlight?.destination || "",
      estimatedTime: selectedFlight?.estimated_duration?.replace(":", "") || "0130",
      alternateAirport: "",
      fuelEndurance: "0400",
      departureMetar: "",
      departureTaf: "",
      destinationMetar: "",
      destinationTaf: "",
      checklistItems: {},
      pilotInCommand: selectedFlight?.crew_members?.full_name || "",
      pilotId: selectedFlight?.crew_member_id || "",
      clientName: selectedFlight?.clients?.company_name || "",
      clientId: selectedFlight?.client_id || "",
      remarks: "",
    };
  });

  const updateFormData = (data: Partial<FlightPlanData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleNext = () => {
    // If on Step 1 and moving to Step 2, trigger the Step 1 complete callback
    if (currentStep === 1 && onStep1Complete) {
      onStep1Complete(formData);
      return;
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      onBack();
    }
  };

  const handleSubmit = () => {
    toast.success("Plano de voo criado com sucesso!");
    if (onComplete) {
      onComplete(formData);
    } else {
      onBack();
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1AircraftInfo formData={formData} updateFormData={updateFormData} />;
      case 2:
        return <Step2FlightRules formData={formData} updateFormData={updateFormData} />;
      case 3:
        return <Step3Route formData={formData} updateFormData={updateFormData} />;
      case 4:
        return <Step4Weather formData={formData} updateFormData={updateFormData} />;
      case 5:
        return <Step5Checklist formData={formData} updateFormData={updateFormData} />;
      case 6:
        return <Step6Summary formData={formData} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Plano de Voo</h1>
          <p className="text-cyan-200/70 mt-1">
            {selectedFlight
              ? `Baseado no agendamento: ${selectedFlight.origin} → ${selectedFlight.destination}`
              : "Novo plano de voo"}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-slate-400 hover:text-white hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* Step Indicator */}
      <StepIndicator steps={STEPS} currentStep={currentStep} />

      {/* Step Content */}
      <div className="mt-8 min-h-[500px]">
        {renderStep()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-700">
        <Button
          variant="outline"
          onClick={handlePrev}
          className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 1 ? "Cancelar" : "Anterior"}
        </Button>

        {currentStep < STEPS.length ? (
          <Button
            onClick={handleNext}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20"
          >
            Próximo
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-500/20"
          >
            <Check className="h-4 w-4 mr-2" />
            Finalizar Plano de Voo
          </Button>
        )}
      </div>
    </div>
  );
}
