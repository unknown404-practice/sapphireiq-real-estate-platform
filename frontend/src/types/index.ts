export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  createdAt?: string;
}

export type PropertyType = 'apartment' | 'house' | 'villa' | 'plot' | 'commercial';
export type ListingType = 'sale' | 'rent';
export type PropertyStatus = 'draft' | 'published' | 'archived';

export interface PropertyImage {
  url: string;
  fileId?: string;
  caption?: string;
}

export interface Property {
  _id: string;
  title: string;
  description: string;
  propertyType: PropertyType;
  listingType: ListingType;
  price: number;
  city: string;
  state: string;
  locality?: string;
  pincode?: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqFt?: number;
  amenities: string[];
  images: PropertyImage[];
  owner: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  } | string;
  status: PropertyStatus;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Appointment {
  _id: string;
  property: Property | string;
  user?: User | string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  scheduledAt: string;
  status: AppointmentStatus;
  notes?: string;
  propertyTitle?: string;
  propertyCity?: string;
  propertyThumbnail?: string;
  propertyPrice?: number;
  propertyOwner?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: Pagination;
  token?: string;
  user?: User;
  devResetToken?: string;
}

export interface FilterParams {
  city?: string;
  propertyType?: string;
  listingType?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  bedrooms?: number | string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}
