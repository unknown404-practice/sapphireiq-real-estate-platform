import mongoose, { Schema } from 'mongoose';
import { IPropertyDocument } from '../types';

const PropertyImageSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
    },
    fileId: {
      type: String,
    },
    caption: {
      type: String,
    },
  },
  { _id: false }
);

const PropertySchema = new Schema<IPropertyDocument>(
  {
    title: {
      type: String,
      required: [true, 'Property title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Property description is required'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    propertyType: {
      type: String,
      required: [true, 'Property type is required'],
      enum: ['apartment', 'house', 'villa', 'plot', 'commercial'],
    },
    listingType: {
      type: String,
      required: [true, 'Listing type is required'],
      enum: ['sale', 'rent'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be greater than or equal to 0'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      index: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    locality: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    bedrooms: {
      type: Number,
      min: [0, 'Bedrooms cannot be negative'],
    },
    bathrooms: {
      type: Number,
      min: [0, 'Bathrooms cannot be negative'],
    },
    areaSqFt: {
      type: Number,
      min: [0, 'Area cannot be negative'],
    },
    amenities: {
      type: [String],
      default: [],
    },
    images: {
      type: [PropertyImageSchema],
      validate: {
        validator: function (val: any[]) {
          return val.length <= 4;
        },
        message: 'A property can have a maximum of 4 images',
      },
      default: [],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

PropertySchema.index({ status: 1, city: 1, listingType: 1, price: 1 });
PropertySchema.index({ status: 1, propertyType: 1 });
PropertySchema.index({ owner: 1, status: 1 });
PropertySchema.index(
  { title: 'text', description: 'text', locality: 'text', city: 'text' },
  { weights: { title: 10, locality: 5, city: 3, description: 1 } }
);

export const Property = (mongoose.models.Property as mongoose.Model<IPropertyDocument>) || mongoose.model<IPropertyDocument>('Property', PropertySchema);
