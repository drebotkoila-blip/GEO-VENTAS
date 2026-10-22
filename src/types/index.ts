export type RepStatus = 'on_route' | 'in_meeting' | 'available' | 'offline';

export type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type VisitOutcome = 'sale_closed' | 'negotiation' | 'rescheduled' | 'not_interested' | 'contact_absent';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RoutePoint extends Coordinates {
  timestamp: string;
  speedKmH?: number;
}

export interface SalesRep {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  territory: string;
  roleTitle?: string;
  vehicleType?: 'car' | 'motorcycle' | 'transit' | 'walking';
  hireDate?: string;
  dni?: string;
  currentCoords: Coordinates;
  lastPing: string;
  status: RepStatus;
  batteryLevel: number;
  speedKmH: number;
  heading?: number;
  totalDistanceKmToday: number;
  routeHistory: RoutePoint[];
}

export type ClientCrmStatus = 'active' | 'prospect' | 'inactive' | 'negotiation';

export type ClientCategory = 'Retail' | 'Distribuidor' | 'Corporativo' | 'Pyme' | 'Salud' | 'Industria' | 'Otro';

export interface Client {
  id: string;
  code?: string; // Código de cliente (ej: CLI-001)
  name: string;
  company: string;
  cif?: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  pais?: string; // País (ej: España)
  coords: Coordinates;
  geofenceRadiusMeters?: number;
  priority?: 'alta' | 'media' | 'baja';
  category: ClientCategory | string;
  status?: ClientCrmStatus;
  notes?: string;
}

export interface Visit {
  id: string;
  repId: string;
  clientId: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  status: VisitStatus;
  objective: string;
  checkInTime?: string;
  checkInCoords?: Coordinates;
  checkInDistanceMeters?: number;
  isWithinGeofence?: boolean;
  geofenceOverrideReason?: string;
  checkOutTime?: string;
  checkOutCoords?: Coordinates;
  durationMinutes?: number;
  outcome?: VisitOutcome;
  saleAmount?: number;
  notes?: string;
  clientFeedbackRating?: number;
  signatureBase64?: string;
  photoUrl?: string;
}

export interface GeolocationState {
  coords: Coordinates | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number | null;
  error: string | null;
  isTracking: boolean;
  isSimulated: boolean;
}
