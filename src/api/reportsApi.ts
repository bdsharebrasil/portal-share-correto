import { supabase } from '@/integrations/supabase/client';
import type { FinancialSummary, MonthlyExpense } from '@/types/maintenance';

export async function generateFinancialReport(aircraftId: string): Promise<FinancialSummary> {
  try {
    // Get all RAS for the aircraft
    const { data: rasList } = await supabase
      .from('ras')
      .select('*')
      .eq('aircraft_id', aircraftId);

    // Get all motor expenses
    const { data: motorExpenses } = await supabase
      .from('motor_expenses')
      .select('*')
      .eq('aircraft_id', aircraftId);

    // Calculate totals
    const totalMaintenanceCost = rasList?.reduce((sum, ras: any) => sum + (ras.total_cost || 0), 0) || 0;
    const totalMotorCost = motorExpenses?.reduce((sum, exp: any) => sum + (exp.cost || 0), 0) || 0;

    // Calculate by category
    const costByCategory: Record<string, number> = {};

    // Add motor expenses
    if (motorExpenses && motorExpenses.length > 0) {
      costByCategory['Motores'] = totalMotorCost;
    }

    // Add maintenance costs
    if (rasList && rasList.length > 0) {
      rasList.forEach((ras: any) => {
        if (ras.cost_items && Array.isArray(ras.cost_items)) {
          ras.cost_items.forEach((item: any) => {
            const category = item.category || 'Geral';
            costByCategory[category] = (costByCategory[category] || 0) + (item.totalValue || 0);
          });
        }
      });
    }

    // Calculate monthly expenses
    const monthlyExpenses = calculateMonthlyExpenses(rasList, motorExpenses);

    return {
      aircraftId,
      totalMaintenanceCost,
      totalMotorCost,
      totalPartsCost: costByCategory['Peças'] || 0,
      totalLaborCost: costByCategory['Mão de Obra'] || 0,
      costByCategory,
      monthlyExpenses,
      yearlyTotal: totalMaintenanceCost + totalMotorCost,
    };
  } catch (error) {
    console.error('Error generating financial report:', error);
    throw error;
  }
}

export async function generateMaintenanceReport(aircraftId: string) {
  try {
    const { data: maintenanceItems } = await supabase
      .from('maintenance_items')
      .select('*')
      .eq('aircraft_id', aircraftId)
      .order('next_due_date', { ascending: true });

    const { data: aircraft } = await supabase
      .from('aircraft')
      .select('*')
      .eq('id', aircraftId)
      .single();

    if (!aircraft) throw new Error('Aircraft not found');

    // Categorize items
    const byStatus = {
      expired: maintenanceItems?.filter((m: any) => m.status === 'expired') || [],
      urgent: maintenanceItems?.filter((m: any) => m.status === 'urgent') || [],
      attention: maintenanceItems?.filter((m: any) => m.status === 'attention') || [],
      ok: maintenanceItems?.filter((m: any) => m.status === 'ok') || [],
    };

    return {
      aircraft,
      items: maintenanceItems,
      byStatus,
      summary: {
        total: maintenanceItems?.length || 0,
        ...Object.fromEntries(Object.entries(byStatus).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
      },
    };
  } catch (error) {
    console.error('Error generating maintenance report:', error);
    throw error;
  }
}

export async function generateADSBReport(aircraftId: string) {
  try {
    const { data: ads } = await supabase
      .from('airworthiness_directives')
      .select('*')
      .eq('aircraft_id', aircraftId)
      .order('issue_date', { ascending: false });

    const { data: sbs } = await supabase
      .from('service_bulletins')
      .select('*')
      .eq('aircraft_id', aircraftId)
      .order('issue_date', { ascending: false });

    return {
      directives: ads || [],
      bulletins: sbs || [],
      summary: {
        totalADs: ads?.length || 0,
        adsPending: ads?.filter((ad: any) => ad.status === 'pendente').length || 0,
        adsCompleted: ads?.filter((ad: any) => ad.status === 'concluido').length || 0,
        totalSBs: sbs?.length || 0,
        sbsPending: sbs?.filter((sb: any) => sb.status === 'pendente').length || 0,
        sbsCompleted: sbs?.filter((sb: any) => sb.status === 'concluido').length || 0,
      },
    };
  } catch (error) {
    console.error('Error generating AD/SB report:', error);
    throw error;
  }
}

export async function generateComponentReport(aircraftId: string) {
  try {
    const { data: components } = await supabase
      .from('aircraft_components')
      .select('*')
      .eq('aircraft_id', aircraftId)
      .order('current_life', { ascending: false });

    const critical = components?.filter((c: any) => (c.current_life / c.total_life) * 100 >= 80) || [];
    const warning = components?.filter((c: any) => {
      const percent = (c.current_life / c.total_life) * 100;
      return percent >= 60 && percent < 80;
    }) || [];

    return {
      components: components || [],
      summary: {
        total: components?.length || 0,
        critical: critical.length,
        warning: warning.length,
        healthy: (components?.length || 0) - critical.length - warning.length,
      },
      criticalComponents: critical,
    };
  } catch (error) {
    console.error('Error generating component report:', error);
    throw error;
  }
}

export async function generateComplianceReport(aircraftId: string) {
  try {
    const { data: aircraft } = await supabase
      .from('aircraft')
      .select('*')
      .eq('id', aircraftId)
      .single();

    const { data: certifications } = await supabase
      .from('certifications')
      .select('*')
      .eq('aircraft_id', aircraftId);

    const { data: insurances } = await supabase
      .from('insurance_policies')
      .select('*')
      .eq('aircraft_id', aircraftId);

    const today = new Date();

    const expiringCertifications = certifications?.filter((c: any) => {
      const expDate = new Date(c.expiration_date);
      const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 90 && daysUntil > 0;
    }) || [];

    const expiredCertifications = certifications?.filter((c: any) => {
      const expDate = new Date(c.expiration_date);
      return expDate < today;
    }) || [];

    const expiringInsurances = insurances?.filter((i: any) => {
      const expDate = new Date(i.expiration_date);
      const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 90 && daysUntil > 0;
    }) || [];

    return {
      aircraft,
      certifications: certifications || [],
      insurances: insurances || [],
      compliance: {
        totalCertifications: certifications?.length || 0,
        expiringCertifications: expiringCertifications.length,
        expiredCertifications: expiredCertifications.length,
        totalInsurances: insurances?.length || 0,
        expiringInsurances: expiringInsurances.length,
        overallCompliance: expiredCertifications.length === 0 ? 'Compliant' : 'Non-Compliant',
      },
    };
  } catch (error) {
    console.error('Error generating compliance report:', error);
    throw error;
  }
}

function calculateMonthlyExpenses(
  rasList: any[],
  motorExpenses: any[]
): MonthlyExpense[] {
  const monthlyData: Record<string, MonthlyExpense> = {};

  // Add RAS expenses
  rasList?.forEach((ras: any) => {
    const date = new Date(ras.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date),
        total: 0,
        byCategory: {},
      };
    }

    monthlyData[monthKey].total += ras.total_cost || 0;
  });

  // Add motor expenses
  motorExpenses?.forEach((exp: any) => {
    const date = new Date(exp.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date),
        total: 0,
        byCategory: {},
      };
    }

    monthlyData[monthKey].total += exp.cost || 0;
    monthlyData[monthKey].byCategory['Motores'] = (monthlyData[monthKey].byCategory['Motores'] || 0) + (exp.cost || 0);
  });

  return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
}
