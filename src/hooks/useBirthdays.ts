import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  addYears,
  differenceInCalendarDays,
  format,
  isSameMonth,
  isValid,
  parse,
  parseISO,
  setYear,
  startOfDay,
} from "date-fns";

type BirthdayRow = Database["public"]["Tables"]["birthdays"]["Row"];

export type ProcessedBirthday = BirthdayRow & {
  displayDate: string;
  parsedDate: Date | null;
  currentYearDate: Date | null;
  nextOccurrence: Date | null;
  source?: "birthdays" | "user_profiles";
};

const parseBirthdayDate = (value: string): Date | null => {
  if (!value) return null;

  const isoCandidate = parseISO(value);
  if (isValid(isoCandidate)) {
    return isoCandidate;
  }

  const parsedWithYear = parse(value, "dd/MM/yyyy", new Date());
  if (isValid(parsedWithYear)) {
    return parsedWithYear;
  }

  const parsedWithoutYear = parse(value, "dd/MM", new Date());
  if (isValid(parsedWithoutYear)) {
    return parsedWithoutYear;
  }

  return null;
};

export const useBirthdays = (daysAhead: number = 7) => {
  const today = useMemo(() => startOfDay(new Date()), []);

  // Query for birthdays table
  const birthdaysQuery = useQuery({
    queryKey: ["birthdays-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("birthdays")
        .select("id,nome,data_aniversario,empresa,category,avatar_url,created_at,updated_at")
        .order("data_aniversario", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  // Query for user_profiles with birth_date
  const userProfilesQuery = useQuery({
    queryKey: ["user-profiles-birthdays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, display_name, birth_date, departamento, avatar_url")
        .not("birth_date", "is", null)
        .order("birth_date", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const processedBirthdays = useMemo<ProcessedBirthday[]>(() => {
    const birthdaysList: ProcessedBirthday[] = [];

    // Process birthdays table data
    if (birthdaysQuery.data) {
      birthdaysQuery.data.forEach((birthday) => {
        const parsedDate = parseBirthdayDate(birthday.data_aniversario);
        const currentYearDate = parsedDate ? setYear(parsedDate, today.getFullYear()) : null;
        let nextOccurrence = currentYearDate;

        if (nextOccurrence && differenceInCalendarDays(nextOccurrence, today) < 0) {
          nextOccurrence = addYears(nextOccurrence, 1);
        }

        birthdaysList.push({
          ...birthday,
          parsedDate,
          currentYearDate,
          nextOccurrence,
          displayDate: parsedDate ? format(parsedDate, "dd/MM") : birthday.data_aniversario,
          source: "birthdays",
        });
      });
    }

    // Process user_profiles birth_date data
    if (userProfilesQuery.data) {
      userProfilesQuery.data.forEach((profile) => {
        if (!profile.birth_date) return;

        const parsedDate = parseBirthdayDate(profile.birth_date);
        const currentYearDate = parsedDate ? setYear(parsedDate, today.getFullYear()) : null;
        let nextOccurrence = currentYearDate;

        if (nextOccurrence && differenceInCalendarDays(nextOccurrence, today) < 0) {
          nextOccurrence = addYears(nextOccurrence, 1);
        }

        birthdaysList.push({
          id: `profile-${profile.id}`,
          nome: profile.full_name || profile.display_name || "Colaborador",
          data_aniversario: profile.birth_date,
          empresa: profile.departamento || null,
          avatar_url: profile.avatar_url || null,
          category: "colaboradores" as any,
          created_at: null,
          updated_at: null,
          parsedDate,
          currentYearDate,
          nextOccurrence,
          displayDate: parsedDate ? format(parsedDate, "dd/MM") : profile.birth_date,
          source: "user_profiles",
        });
      });
    }

    return birthdaysList;
  }, [birthdaysQuery.data, userProfilesQuery.data, today]);

  const listThisMonth = useMemo(() => {
    return processedBirthdays.filter((birthday) => {
      if (!birthday.currentYearDate) return false;
      return isSameMonth(birthday.currentYearDate, today);
    });
  }, [processedBirthdays, today]);

  const listNextSevenDays = useMemo(() => {
    return processedBirthdays.filter((birthday) => {
      if (!birthday.nextOccurrence) return false;
      const diff = differenceInCalendarDays(startOfDay(birthday.nextOccurrence), today);
      return diff >= 0 && diff <= daysAhead;
    });
  }, [processedBirthdays, today, daysAhead]);

  const sortedBirthdays = useMemo(() => {
    return [...processedBirthdays].sort((a, b) => {
      if (a.nextOccurrence && b.nextOccurrence) {
        return a.nextOccurrence.getTime() - b.nextOccurrence.getTime();
      }
      if (a.nextOccurrence) return -1;
      if (b.nextOccurrence) return 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [processedBirthdays]);

  const getFilteredBirthdays = useCallback(
    (filter: "month" | "next7" | "all") => {
      switch (filter) {
        case "next7":
          return sortedBirthdays.filter((b) => listNextSevenDays.includes(b));
        case "all":
          return sortedBirthdays;
        case "month":
        default:
          return sortedBirthdays.filter((b) => listThisMonth.includes(b));
      }
    },
    [sortedBirthdays, listNextSevenDays, listThisMonth]
  );

  return {
    processedBirthdays,
    listThisMonth,
    listNextSevenDays,
    sortedBirthdays,
    getFilteredBirthdays,
    isLoading: birthdaysQuery.isLoading || userProfilesQuery.isLoading,
    error: birthdaysQuery.error || userProfilesQuery.error,
    refetch: () => {
      birthdaysQuery.refetch();
      userProfilesQuery.refetch();
    },
    birthdaysThisMonth: listThisMonth.length,
    birthdaysNextSevenDays: listNextSevenDays.length,
    totalBirthdays: processedBirthdays.length,
    today,
  };
};
