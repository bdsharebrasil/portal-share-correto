import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Payslip {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  file_path: string;
  uploaded_at: string | null;
  uploaded_by: string | null;
}

export function usePayslips(employeeId?: string) {
  return useQuery({
    queryKey: ["payslips", employeeId],
    queryFn: async () => {
      if (!employeeId) return [] as Payslip[];

      const { data, error } = await supabase
        .from("employee_payslips")
        .select("*")
        .eq("employee_id", employeeId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (error) {
        console.error("Error fetching payslips:", error);
        return [] as Payslip[];
      }

      return (data || []) as Payslip[];
    },
    enabled: !!employeeId,
  });
}

export function usePayslipsByMonth(employeeId?: string, month?: number, year?: number) {
  return useQuery({
    queryKey: ["payslips-month", employeeId, month, year],
    queryFn: async () => {
      if (!employeeId || month === undefined || year === undefined) return null;

      const { data, error } = await supabase
        .from("employee_payslips")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("month", month)
        .eq("year", year)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching payslip:", error);
        return null;
      }

      return data as Payslip | null;
    },
    enabled: !!employeeId && month !== undefined && year !== undefined,
  });
}

export function getPayslipPublicUrl(filePath: string): string {
  const { data } = supabase.storage.from("holerites").getPublicUrl(filePath);
  return data?.publicUrl || "";
}
