import { Request } from 'express';
import { Document, Types } from 'mongoose';

export type UserRole = 'user' | 'admin';

export interface IUser {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
  comparePassword(enteredPassword: string): Promise<boolean>;
}

export type PropertyType = 'apartment' | 'house' | 'villa' | 'plot' | 'commercial';
export type ListingType = 'sale' | 'rent';
export type PropertyStatus = 'draft' | 'published' | 'archived';

export interface IPropertyImage {
  url: string;
  fileId?: string;
  caption?: string;
}

export interface IProperty {
  title: string;
  description: string;
  propertyType: PropertyType;
  listingType: ListingType;
  price: number; // in INR
  city: string;
  state: string;
  locality?: string;
  pincode?: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqFt?: number;
  amenities: string[];
  images: IPropertyImage[]; // max 4 images
  owner: Types.ObjectId;
  status: PropertyStatus;
  featured?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPropertyDocument extends IProperty, Document {
  _id: Types.ObjectId;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface IAppointment {
  property: Types.ObjectId;
  user?: Types.ObjectId;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  scheduledAt: Date;
  status: AppointmentStatus;
  notes?: string;
  propertyTitle?: string;
  propertyCity?: string;
  propertyThumbnail?: string;
  propertyPrice?: number;
  propertyOwner?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAppointmentDocument extends IAppointment, Document {
  _id: Types.ObjectId;
}

export interface AuthUserPayload {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}
