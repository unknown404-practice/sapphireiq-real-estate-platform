import mongoose, { Schema } from 'mongoose';
import { IAppointmentDocument } from '../types';

const AppointmentSchema = new Schema<IAppointmentDocument>(
  {
    property: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property reference is required'],
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    guestName: {
      type: String,
      trim: true,
    },
    guestEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    guestPhone: {
      type: String,
      trim: true,
    },
    scheduledAt: {
      type: Date,
      required: [true, 'Scheduled viewing time is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    propertyTitle: {
      type: String,
      trim: true,
    },
    propertyCity: {
      type: String,
      trim: true,
    },
    propertyThumbnail: {
      type: String,
      trim: true,
    },
    propertyPrice: {
      type: Number,
    },
    propertyOwner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index to find user, guest, and owner appointments quickly
AppointmentSchema.index({ user: 1, scheduledAt: -1 });
AppointmentSchema.index({ property: 1, scheduledAt: -1 });
AppointmentSchema.index({ propertyOwner: 1, scheduledAt: -1 });
AppointmentSchema.index({ guestEmail: 1, scheduledAt: -1 });

export const Appointment = mongoose.model<IAppointmentDocument>('Appointment', AppointmentSchema);
