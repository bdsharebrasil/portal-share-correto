import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, isWithinInterval, parseISO, addMonths, isBefore, isAfter, startOfToday } from "date-fns";
import { StatCard } from "@/components/StatCard";
import {
  CalendarDays,
  Sun,
  Calendar,
  Palmtree
} from "lucide-react";

export default function CalendarioFerias() {
  const today = startOfToday();

  // Fetch all user profiles
  const { data: userProfiles = [] } = useQuery({
    queryKey: ["user-profiles-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, avatar_url, employment_status")
        .eq("tipo", "colaborador");
      if (error) throw error;
      return data;
    },
  });

  // Fetch approved vacation requests
  const { data: vacationRequests = [], isLoading } = useQuery({
    queryKey: ["approved-vacation-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("*")
        .eq("status", "approved")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Combine vacations with user info
  const enrichedVacations = useMemo(() => {
    return vacationRequests.map((vacation: any) => {
      const user = userProfiles.find((p: any) => p.id === vacation.user_id);
      return {
        ...vacation,
        user_name: user?.full_name || "Colaborador",
        user_avatar: user?.avatar_url,
        employment_status: user?.employment_status,
      };
    });
  }, [vacationRequests, userProfiles]);

  // People currently on vacation (today)
  const currentlyOnVacation = useMemo(() => {
    return enrichedVacations.filter((vacation: any) => {
      const start = parseISO(vacation.start_date);
      const end = parseISO(vacation.end_date);
      return isWithinInterval(today, { start, end });
    });
  }, [enrichedVacations, today]);

  // Upcoming vacations (next 30 days)
  const upcomingVacations = useMemo(() => {
    const next30Days = addMonths(today, 1);
    return enrichedVacations.filter((vacation: any) => {
      const start = parseISO(vacation.start_date);
      return isAfter(start, today) && isBefore(start, next30Days);
    });
  }, [enrichedVacations, today]);

  const VacationCard = ({ vacation, showDates = true }: { vacation: any; showDates?: boolean }) => {
    const isOngoing = isWithinInterval(today, { 
      start: parseISO(vacation.start_date), 
      end: parseISO(vacation.end_date) 
    });

    return (
      <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
        isOngoing 
          ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border-emerald-500/30" 
          : "bg-muted/30 border-border/50 hover:border-primary/30"
      }`}>
        <Avatar className="h-10 w-10 border-2 border-primary/20">
          <AvatarImage src={vacation.user_avatar || undefined} alt={vacation.user_name} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
            {vacation.user_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground truncate">{vacation.user_name}</p>
            {isOngoing && (
              <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-xs">
                <Sun className="w-3 h-3 mr-1" />
                Em férias
              </Badge>
            )}
          </div>
          {showDates && (
            <p className="text-sm text-muted-foreground">
              {format(parseISO(vacation.start_date), "dd/MM")} - {format(parseISO(vacation.end_date), "dd/MM/yyyy")}
              <span className="ml-2 text-primary">({vacation.days} dias)</span>
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="p-3 bg-amber-500/10 rounded-xl">
          <CalendarDays className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">
            Calendário de Férias
          </h1>
          <p className="text-gray-400">
            Visualize férias aprovadas e programe-se
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <StatCard
          label="Em férias agora"
          value={currentlyOnVacation.length}
          icon={Sun}
          color="green"
          subtext="Colaboradores ausentes"
        />
        <StatCard
          label="Próximos 30 dias"
          value={upcomingVacations.length}
          icon={Calendar}
          color="blue"
          subtext="Férias agendadas"
        />
        <StatCard
          label="Total aprovadas"
          value={enrichedVacations.length}
          icon={Palmtree}
          color="purple"
          subtext="Neste ano"
        />
      </div>

      {/* Vacations List */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Carregando...</div>
          ) : enrichedVacations.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-800 rounded-full p-6 w-fit mx-auto mb-4">
                <CalendarDays className="w-12 h-12 text-gray-700" />
              </div>
              <p className="text-gray-500">Calendário vazio para este período.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {enrichedVacations.map((vacation: any) => (
                <VacationCard key={vacation.id} vacation={vacation} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
