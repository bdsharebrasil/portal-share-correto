import { useState, useEffect } from "react";
import { Cake, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useTodayBirthdays } from "@/hooks/useTodayBirthdays";

export const BirthdayAlert = () => {
  const { toast } = useToast();
  const { birthdaysToday, hasShownToastToday, hasTodayBirthdays } = useTodayBirthdays();
  const [isVisible, setIsVisible] = useState(false);
  const [toastShown, setToastShown] = useState(false);

  // Show toast on first access of the day if there are birthdays
  useEffect(() => {
    if (hasShownToastToday && hasTodayBirthdays && !toastShown) {
      setToastShown(true);
      setIsVisible(true);
      
      const birthdayNames = birthdaysToday.map(b => b.nome).join(", ");
      toast({
        title: "🎂 Aniversários Hoje!",
        description: `${birthdayNames} está${birthdaysToday.length > 1 ? "ão" : ""} fazendo aniversário hoje!`,
        duration: 5000,
      });
    }
  }, [hasShownToastToday, hasTodayBirthdays, birthdaysToday, toastShown, toast]);

  if (!hasTodayBirthdays) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative h-10 w-10 transition-all ${
            isVisible
              ? "bg-primary/20 hover:bg-primary/30 border-primary/50 border"
              : "hover:bg-accent"
          }`}
          title="Aniversários de hoje"
        >
          <Cake className="h-5 w-5 text-primary" />
          {birthdaysToday.length > 0 && (
            <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
              {birthdaysToday.length}
            </span>
          )}
          {isVisible && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
              }}
              className="absolute -top-2 -right-2 bg-destructive rounded-full p-0.5 hover:bg-destructive/90 transition-colors"
              title="Fechar"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Cake className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">
              Aniversários de Hoje
            </h3>
          </div>
          <div className="space-y-2">
            {birthdaysToday.map((birthday) => (
              <div
                key={birthday.id}
                className="flex items-center justify-between p-2 rounded-md bg-primary/5 border border-primary/20"
              >
                <div>
                  <p className="font-medium text-foreground">{birthday.nome}</p>
                  {birthday.empresa && (
                    <p className="text-xs text-muted-foreground">
                      {birthday.empresa}
                    </p>
                  )}
                </div>
                <Cake className="h-4 w-4 text-primary flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
