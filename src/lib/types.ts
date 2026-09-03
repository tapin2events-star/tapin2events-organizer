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
  latitude: number | null;
  longitude: number | null;
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

export type ResourceBookingStatus = 'pending' | 'accepted' | 'rejected' | 'counter_offered' | 'confirmed' | 'completed' | 'cancelled' | 'deleted';

export interface ResourceBooking {
  id: string;
  event_id: string;
  resource_id: string;
  organizer_email: string;
  resource_email: string;
  booking_details: {
    service_date?: string;
    start_time?: string;
    end_time?: string;
    special_requirements?: string;
  };
  offered_rate: number;
  counter_offer_rate: number | null;
  message_from_organizer: string | null;
  response_from_resource: string | null;
  status: ResourceBookingStatus;
  created_at: string;
}

export interface ResourceReview {
  id: string;
  resource_id: string;
  booking_id: string;
  reviewer_email: string;
  rating: number;
  comment: string | null;
  would_recommend: boolean | null;
  created_at: string;
}

export interface ResourceMedia {
  id: string;
  resource_id: string;
  media_type: 'image' | 'video';
  media_url: string;
  caption: string | null;
  display_order: number;
}

export type ProductCategory = 'apparel' | 'accessories' | 'food' | 'drinks' | 'vip_bundle' | 'add_on' | 'merchandise' | 'series_pass' | 'other';
export type FulfillmentStatus = 'pending' | 'ready_for_pickup' | 'picked_up' | 'shipped' | 'delivered';

export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'apparel', label: 'Apparel' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'food', label: 'Food' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'vip_bundle', label: 'VIP Bundle' },
  { value: 'add_on', label: 'Add-on' },
  { value: 'other', label: 'Other' },
];

export interface Product {
  id: string;
  event_id: string | null;
  resource_id: string | null;
  seller_email: string;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  stock_quantity: number;
  sold_quantity: number;
  category: ProductCategory;
  visibility: 'public' | 'hidden' | 'attendee_only';
  pickup_required: boolean;
  shipping_available: boolean;
  shipping_cost: number;
  is_active: boolean;
}

export interface ProductOrder {
  id: string;
  order_number: string;
  customer_email: string;
  customer_name: string | null;
  items: Array<{ type: string; item_id: string; item_name: string; quantity: number; unit_price: number; total_price: number; image_url?: string }>;
  total_amount: number;
  payment_status: string;
  fulfillment_status: FulfillmentStatus;
  shipping_address: { name?: string; address_line1?: string; address_line2?: string; city?: string; state?: string; postal_code?: string; country?: string } | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  created_at: string;
}

export const FULFILLMENT_STYLES: Record<FulfillmentStatus, string> = {
  pending: 'bg-orange-100 text-orange-800',
  ready_for_pickup: 'bg-blue-100 text-blue-800',
  picked_up: 'bg-green-100 text-green-800',
  shipped: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
};

export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  pending: 'Pending',
  ready_for_pickup: 'Ready for pickup',
  picked_up: 'Picked up',
  shipped: 'Shipped',
  delivered: 'Delivered',
};
