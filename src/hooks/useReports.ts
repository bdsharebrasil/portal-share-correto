import { useState, useCallback } from 'react';
import {
  generateFinancialReport,
  generateMaintenanceReport,
  generateADSBReport,
  generateComponentReport,
  generateComplianceReport,
} from '@/api/reportsApi';
import type { FinancialSummary } from '@/types/maintenance';

interface MaintenanceReportData {
  aircraft: any;
  items: any[];
  byStatus: Record<string, any[]>;
  summary: Record<string, number>;
}

interface ADSBReportData {
  directives: any[];
  bulletins: any[];
  summary: {
    totalADs: number;
    adsPending: number;
    adsCompleted: number;
    totalSBs: number;
    sbsPending: number;
    sbsCompleted: number;
  };
}

interface ComponentReportData {
  components: any[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    healthy: number;
  };
  criticalComponents: any[];
}

interface ComplianceReportData {
  aircraft: any;
  certifications: any[];
  insurances: any[];
  compliance: {
    totalCertifications: number;
    expiringCertifications: number;
    expiredCertifications: number;
    totalInsurances: number;
    expiringInsurances: number;
    overallCompliance: string;
  };
}

export function useReports(aircraftId: string) {
  const [financialReport, setFinancialReport] = useState<FinancialSummary | null>(null);
  const [maintenanceReport, setMaintenanceReport] = useState<MaintenanceReportData | null>(null);
  const [adsbReport, setADSBReport] = useState<ADSBReportData | null>(null);
  const [componentReport, setComponentReport] = useState<ComponentReportData | null>(null);
  const [complianceReport, setComplianceReport] = useState<ComplianceReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFinancialReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const report = await generateFinancialReport(aircraftId);
      setFinancialReport(report);
      return report;
    } catch (err: any) {
      const message = err.message || 'Erro ao gerar relatório financeiro';
      setError(message);
      console.error('Error fetching financial report:', err);
    } finally {
      setLoading(false);
    }
  }, [aircraftId]);

  const fetchMaintenanceReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const report = await generateMaintenanceReport(aircraftId);
      setMaintenanceReport(report);
      return report;
    } catch (err: any) {
      const message = err.message || 'Erro ao gerar relatório de manutenção';
      setError(message);
      console.error('Error fetching maintenance report:', err);
    } finally {
      setLoading(false);
    }
  }, [aircraftId]);

  const fetchADSBReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const report = await generateADSBReport(aircraftId);
      setADSBReport(report);
      return report;
    } catch (err: any) {
      const message = err.message || 'Erro ao gerar relatório de AD/SB';
      setError(message);
      console.error('Error fetching AD/SB report:', err);
    } finally {
      setLoading(false);
    }
  }, [aircraftId]);

  const fetchComponentReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const report = await generateComponentReport(aircraftId);
      setComponentReport(report);
      return report;
    } catch (err: any) {
      const message = err.message || 'Erro ao gerar relatório de componentes';
      setError(message);
      console.error('Error fetching component report:', err);
    } finally {
      setLoading(false);
    }
  }, [aircraftId]);

  const fetchComplianceReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const report = await generateComplianceReport(aircraftId);
      setComplianceReport(report);
      return report;
    } catch (err: any) {
      const message = err.message || 'Erro ao gerar relatório de conformidade';
      setError(message);
      console.error('Error fetching compliance report:', err);
    } finally {
      setLoading(false);
    }
  }, [aircraftId]);

  const fetchAllReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([
        fetchFinancialReport(),
        fetchMaintenanceReport(),
        fetchADSBReport(),
        fetchComponentReport(),
        fetchComplianceReport(),
      ]);
    } catch (err: any) {
      const message = err.message || 'Erro ao gerar relatórios';
      setError(message);
      console.error('Error fetching all reports:', err);
    } finally {
      setLoading(false);
    }
  }, [
    fetchFinancialReport,
    fetchMaintenanceReport,
    fetchADSBReport,
    fetchComponentReport,
    fetchComplianceReport,
  ]);

  return {
    financialReport,
    maintenanceReport,
    adsbReport,
    componentReport,
    complianceReport,
    loading,
    error,
    fetchFinancialReport,
    fetchMaintenanceReport,
    fetchADSBReport,
    fetchComponentReport,
    fetchComplianceReport,
    fetchAllReports,
  };
}
