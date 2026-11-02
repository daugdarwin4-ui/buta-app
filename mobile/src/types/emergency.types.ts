export interface EmergencyContact {
  id: string;
  name: string;
  phone_number: string;
  relationship: string;
  notify_by_sms: boolean;
  created_at: string;
}

export interface EmergencyEvent {
  id: string;
  device_id?: string;
  latitude: number;
  longitude: number;
  address?: string;
  contacts_notified: number;
  status: 'active' | 'resolved' | 'cancelled';
  triggered_at: string;
  resolved_at?: string;
}

export type SOSStatus =
  | 'idle'
  | 'countdown'    // 5-second window before SOS fires
  | 'sending'      // Calling server endpoint
  | 'active'       // SOS sent, awaiting resolution
  | 'resolved'
  | 'cancelled'
  | 'error';

export interface SOSState {
  status: SOSStatus;
  event: EmergencyEvent | null;
  countdownSeconds: number;
  error: string | null;
}
