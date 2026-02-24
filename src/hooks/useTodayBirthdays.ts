import { useEffect, useMemo, useState } from "react";
import { useBirthdays } from "./useBirthdays";
import { differenceInCalendarDays, startOfDay, format } from "date-fns";

export const useTodayBirthdays = () => {
  const { processedBirthdays, today } = useBirthdays();
  const [hasShownToastToday, setHasShownToastToday] = useState(false);

  // Get today's birthdays
  const birthdaysToday = useMemo(() => {
    return processedBirthdays.filter((birthday) => {
      if (!birthday.currentYearDate) return false;
      const diff = differenceInCalendarDays(startOfDay(birthday.currentYearDate), today);
      return diff === 0;
    });
  }, [processedBirthdays, today]);

  // Check if we should show the toast (first access of the day)
  useEffect(() => {
    const todayKey = format(today, "yyyy-MM-dd");
    const lastShownKey = "birthday-toast-shown-date";
    const lastShownDate = localStorage.getItem(lastShownKey);

    if (lastShownDate !== todayKey) {
      setHasShownToastToday(true);
      localStorage.setItem(lastShownKey, todayKey);
    }
  }, [today]);

  return {
    birthdaysToday,
    hasShownToastToday,
    hasTodayBirthdays: birthdaysToday.length > 0,
  };
};
