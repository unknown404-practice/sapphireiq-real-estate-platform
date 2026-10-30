import mongoose, { Document, Schema } from 'mongoose';

export interface IOrphanedUpload extends Document {
  fileId: string;
  url: string;
  errorReason: string;
  retryCount: number;
  status: 'pending' | 'processing' | 'resolved' | 'failed';
  lastAttemptAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrphanedUploadSchema = new Schema<IOrphanedUpload>(
  {
    fileId: { type: String, required: true, index: true },
    url: { type: String, required: true },
    errorReason: { type: String, required: true },
    retryCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'resolved', 'failed'],
      default: 'pending',
      index: true,
    },
    lastAttemptAt: { type: Date },
  },
  { timestamps: true }
);

export const OrphanedUpload = (mongoose.models.OrphanedUpload as mongoose.Model<IOrphanedUpload>) || mongoose.model<IOrphanedUpload>('OrphanedUpload', OrphanedUploadSchema);
