export interface AircraftPartner {
  id: string;
  aircraft_id: string;
  partner_id: string;
  quota_hours: number;
  balance_hours: number;
  created_at: string;
  updated_at: string;
}

export interface HourTransaction {
  id: string;
  aircraft_id: string;
  from_partner_id: string;
  to_partner_id: string;
  hours: number;
  type: 'loan' | 'swap' | 'correction';
  description?: string;
  logbook_entry_id?: string;
  created_at: string;
  created_by?: string;
  metadata?: Record<string, any>;
}

export interface PartnerBalance {
  id: string;
  name: string;
  balance_hours: number;
  quota_hours: number;
  aircraft_id: string;
  partner_id: string;
}

export interface HourTransactionWithDetails extends HourTransaction {
  from_partner_name?: string;
  to_partner_name?: string;
  logbook_entry_details?: any;
}
