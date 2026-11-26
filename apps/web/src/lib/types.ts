/** Shapes of the Bookwise API responses used by the web app. */

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
}

export interface PublicStaff {
  id: string;
  name: string;
  serviceIds: string[];
}

export interface PublicBusiness {
  name: string;
  slug: string;
  timezone: string;
  services: PublicService[];
  staff: PublicStaff[];
}

export interface Slot {
  /** ISO instant (UTC). */
  start: string;
  end: string;
  localDate: string;
  localTime: string;
  staffIds: string[];
}

export interface Availability {
  timezone: string;
  serviceId: string;
  durationMin: number;
  from: string;
  to: string;
  slots: Slot[];
}

export interface TokenPair {
  tokenType: 'Bearer';
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  status: 'CONFIRMED' | 'CANCELLED';
  startsAt: string;
  endsAt: string;
  localDate: string;
  localTime: string;
  business: { name: string; slug: string; timezone: string };
  service: {
    id: string;
    name: string;
    durationMin: number;
    priceCents: number;
  };
  staff: { id: string; name: string };
  customer: { id: string; name: string; email: string };
  notes: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------
//  Business dashboard (private routes)
// ---------------------------------------------------------------------

export type MemberRole = 'OWNER' | 'STAFF';

/** A business the signed-in user belongs to, with their role in it. */
export interface MyBusiness {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  createdAt: string;
  role: MemberRole;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  bufferMin: number;
  priceCents: number;
  active: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  active: boolean;
  serviceIds: string[];
}

/** Weekly working hours in the business's local time. Weekday: 1 = Monday. */
export interface WorkingInterval {
  weekday: number;
  start: string;
  end: string;
}

export interface TimeOff {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}
