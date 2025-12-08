import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isSameMonth, isWithinInterval, parseISO, startOfMonth, endOfMonth, addMonths, isBefore, isAfter, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  CalendarDays, 
  Palmtree, 
  ChevronLeft, 
  ChevronRight,
  Users,
  CalendarCheck,
  Clock,
  Sun,
  Plane
} from "lucide-react";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function CalendarioFerias() {
  const today = startOfToday();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [viewMode, setViewMode] = useState<"month" | "current" | "upcoming" | "all">("current");

  const currentViewDate = new Date(selectedYear, selectedMonth, 1);

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

  // Filter vacations for current month view
  const currentMonthVacations = useMemo(() => {
    const monthStart = startOfMonth(currentViewDate);
    const monthEnd = endOfMonth(currentViewDate);
    
    return enrichedVacations.filter((vacation: any) => {
      const start = parseISO(vacation.start_date);
      const end = parseISO(vacation.end_date);
      
      // Check if vacation overlaps with current month
      return (
        isWithinInterval(monthStart, { start, end }) ||
        isWithinInterval(monthEnd, { start, end }) ||
        isWithinInterval(start, { start: monthStart, end: monthEnd }) ||
        isWithinInterval(end, { start: monthStart, end: monthEnd })
      );
    });
  }, [enrichedVacations, currentViewDate]);

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

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  }, []);

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
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground leading-tight flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5 rounded-xl">
                <CalendarDays className="h-7 w-7 text-white" />
              </div>
              Calendário de Férias
            </h1>
            <p className="text-base lg:text-lg text-muted-foreground mt-2">
              Visualize férias aprovadas e programe-se
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => setViewMode("current")}
            className={`rounded-2xl overflow-hidden transition-all ${
              viewMode === "current"
                ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
                : "hover:shadow-lg"
            }`}
          >
            <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20 rounded-2xl overflow-hidden h-full">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/20 rounded-xl">
                    <Sun className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{currentlyOnVacation.length}</p>
                    <p className="text-sm text-muted-foreground">Em férias agora</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button
            onClick={() => setViewMode("upcoming")}
            className={`rounded-2xl overflow-hidden transition-all ${
              viewMode === "upcoming"
                ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background"
                : "hover:shadow-lg"
            }`}
          >
            <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border-blue-500/20 rounded-2xl overflow-hidden h-full">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <CalendarCheck className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{upcomingVacations.length}</p>
                    <p className="text-sm text-muted-foreground">Próximos 30 dias</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button
            onClick={() => setViewMode("all")}
            className={`rounded-2xl overflow-hidden transition-all ${
              viewMode === "all"
                ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-background"
                : "hover:shadow-lg"
            }`}
          >
            <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 border-violet-500/20 rounded-2xl overflow-hidden h-full">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-violet-500/20 rounded-xl">
                    <Palmtree className="h-6 w-6 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{enrichedVacations.length}</p>
                    <p className="text-sm text-muted-foreground">Total aprovadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Main Calendar View */}
          <Card className="shadow-lg border-border/50 rounded-2xl">
            <CardHeader className="border-b border-border bg-muted/30 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl font-bold">
                  <Palmtree className="h-5 w-5 text-primary" />
                  {viewMode === "month" && "Férias do Mês"}
                  {viewMode === "current" && "Em Férias Agora"}
                  {viewMode === "upcoming" && "Próximas Férias (30 dias)"}
                  {viewMode === "all" && "Todas as Férias Aprovadas"}
                </CardTitle>
                {viewMode === "month" && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevMonth} className="rounded-lg">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <Select
                      value={selectedMonth.toString()}
                      onValueChange={(v) => setSelectedMonth(parseInt(v))}
                    >
                      <SelectTrigger className="w-[130px] rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((month, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={selectedYear.toString()}
                      onValueChange={(v) => setSelectedYear(parseInt(v))}
                    >
                      <SelectTrigger className="w-[90px] rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button variant="outline" size="icon" onClick={handleNextMonth} className="rounded-lg">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando...</div>
              ) : (() => {
                let displayVacations: any[] = [];
                let emptyMessage = "";

                if (viewMode === "month") {
                  displayVacations = currentMonthVacations;
                  emptyMessage = `Não há colaboradores de férias em ${MONTHS[selectedMonth]} de ${selectedYear}`;
                } else if (viewMode === "current") {
                  displayVacations = currentlyOnVacation;
                  emptyMessage = "Nenhum colaborador de férias hoje";
                } else if (viewMode === "upcoming") {
                  displayVacations = upcomingVacations;
                  emptyMessage = "Nenhuma férias agendada para os próximos 30 dias";
                } else if (viewMode === "all") {
                  displayVacations = enrichedVacations;
                  emptyMessage = "Nenhuma férias aprovada";
                }

                return displayVacations.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="bg-muted/50 rounded-full p-6 w-fit mx-auto mb-4">
                      <Plane className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium text-foreground">{emptyMessage}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayVacations.map((vacation: any) => (
                      <VacationCard key={vacation.id} vacation={vacation} />
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

        </div>
      </div>
    </Layout>
  );
}
