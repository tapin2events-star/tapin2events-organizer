export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';
export type EventType = 'free' | 'paid' | 'private';

export interface TapEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  event_type: EventType;
  start_date: string | null;
  end_date: string | null;
  location_name: string | null;
  location_address: string | null;
  poster_url: string | null;
  ticket_price: number;
  max_capacity: number | null;
  status: EventStatus;
  is_recurring: boolean;
  is_online: boolean;
  is_featured: boolean;
  is_seating_enabled: boolean;
  seating_sections: { price: number }[] | null;
  organizer_id: string;
  organizer_email: string;
  vendor_applications_enabled: boolean;
  created_at: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface EventTask {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_by: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
}

export type TicketStatus = 'confirmed' | 'cancelled' | 'refunded' | 'pending';

export interface Ticket {
  id: string;
  event_id: string;
  attendee_email: string;
  order_id: string | null;
  ticket_type: string;
  price_paid: number;
  quantity: number;
  status: TicketStatus;
  occurrence_date: string | null;
  section_name: string | null;
  seat_assignment: string | null;
  created_at: string;
}

export type CollaborationRole = 'admin' | 'editor' | 'viewer';
export type CollaborationStatus = 'pending' | 'accepted' | 'declined';

export interface EventCollaboration {
  id: string;
  event_id: string;
  collaborator_email: string;
  role: CollaborationRole;
  invited_by: string;
  motivation: string | null;
  status: CollaborationStatus;
  created_at: string;
}

export type VendorApplicationStatus = 'pending' | 'approved' | 'rejected' | 'paid' | 'withdrawn';

export interface VendorApplication {
  id: string;
  event_id: string;
  resource_email: string;
  business_name: string;
  description: string;
  requirements: string | null;
  agreed_fee: number;
  status: VendorApplicationStatus;
  created_at: string;
}

export type PricingType = 'fixed' | 'hourly' | 'contact_quote';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type ResourceStatus = 'active' | 'inactive' | 'suspended';

export interface Resource {
  id: string;
  display_name: string;
  email: string;
  categories: string[];
  bio: string;
  location: string | null;
  city: string | null;
  state: string | null;
  profile_image: string | null;
  pricing_type: PricingType;
  base_rate: number;
  pricing_details: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  total_bookings: number;
  average_rating: number;
  review_count: number;
  verification_status: VerificationStatus;
  status: ResourceStatus;
  created_at: string;
}

export const RESOURCE_CATEGORIES = [
  'DJ/Music', 'Photography', 'Videography', 'Catering', 'Decor & Design',
  'Florist', 'Security', 'Transportation', 'Entertainment', 'Venue', 'Rentals', 'Other',
] as const;
