import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment';
import { Property } from '../models/Property';
import { AuthenticatedRequest, AppointmentStatus } from '../types';

// POST /api/appointments/guest
export async function createGuestAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ success: false, error: 'Request body must be a valid JSON object' });
      return;
    }

    const { property: propertyId, guestName, guestEmail, guestPhone, scheduledAt, notes } = req.body;

    if (!propertyId || typeof propertyId !== 'string' || !mongoose.Types.ObjectId.isValid(propertyId)) {
      res.status(400).json({ success: false, error: 'Valid property reference is required' });
      return;
    }

    if (!guestName || !guestEmail || !guestPhone || !scheduledAt) {
      res.status(400).json({
        success: false,
        error: 'Please provide guest name, email, phone number, and scheduled viewing time',
      });
      return;
    }

    if (
      typeof guestName !== 'string' ||
      typeof guestEmail !== 'string' ||
      typeof guestPhone !== 'string' ||
      typeof scheduledAt !== 'string'
    ) {
      res.status(400).json({
        success: false,
        error: 'Guest name, email, phone, and scheduled viewing time must be valid strings',
      });
      return;
    }

    if (notes !== undefined && typeof notes !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Notes must be a valid string',
      });
      return;
    }

    if (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim()) {
      res.status(400).json({
        success: false,
        error: 'Guest name, email, and phone number cannot be empty',
      });
      return;
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
    if (!emailRegex.test(guestEmail.trim())) {
      res.status(400).json({
        success: false,
        error: 'Please provide a valid guest email address',
      });
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      res.status(400).json({
        success: false,
        error: 'Scheduled viewing time must be a valid future date and time',
      });
      return;
    }

    const maxFutureDate = Date.now() + 365 * 24 * 60 * 60 * 1000;
    if (scheduledDate.getTime() > maxFutureDate) {
      res.status(400).json({
        success: false,
        error: 'Viewing appointments cannot be scheduled more than 1 year in advance',
      });
      return;
    }

    if (guestName.trim().length > 100) {
      res.status(400).json({ success: false, error: 'Guest name cannot exceed 100 characters' });
      return;
    }

    if (guestPhone.trim().length > 30) {
      res.status(400).json({ success: false, error: 'Guest phone cannot exceed 30 characters' });
      return;
    }

    if (notes && notes.trim().length > 1000) {
      res.status(400).json({ success: false, error: 'Notes cannot exceed 1000 characters' });
      return;
    }

    // Verify property exists and is published
    const property = await Property.findById(propertyId).populate('owner', 'email');
    if (!property || property.status !== 'published') {
      res.status(404).json({
        success: false,
        error: 'Property is not available for booking',
      });
      return;
    }

    // Property owners cannot book viewings on their own properties via guest email
    const ownerEmail = (property.owner as any)?.email;
    if (ownerEmail && ownerEmail.toLowerCase() === guestEmail.trim().toLowerCase()) {
      res.status(400).json({
        success: false,
        error: 'You cannot schedule a viewing appointment for your own property listing',
      });
      return;
    }

    // Prevent duplicate pending bookings for same guest email on same property
    const existingGuestBooking = await Appointment.findOne({
      property: property._id,
      guestEmail: guestEmail.trim().toLowerCase(),
      status: 'pending',
    });
    if (existingGuestBooking) {
      res.status(409).json({
        success: false,
        error: 'A viewing request for this property with this email address is already pending.',
      });
      return;
    }

    const thumbnail =
      property.images && property.images.length > 0 && property.images[0]?.url
        ? property.images[0].url
        : undefined;

    let appointment;
    try {
      appointment = await Appointment.create({
        property: property._id,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim().toLowerCase(),
        guestPhone: guestPhone.trim(),
        scheduledAt: scheduledDate,
        status: 'pending',
        notes: notes ? notes.trim() : undefined,
        propertyTitle: property.title,
        propertyCity: property.city,
        propertyThumbnail: thumbnail,
        propertyPrice: property.price,
        propertyOwner: (property.owner as any)?._id || property.owner,
      });
    } catch (createErr: any) {
      if (createErr.code === 11000) {
        res.status(409).json({
          success: false,
          error: 'A viewing request for this property with this email address is already pending.',
        });
        return;
      }
      throw createErr;
    }

    res.status(201).json({
      success: true,
      data: appointment,
      message: 'Viewing appointment booked successfully! The agent will reach out shortly.',
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/appointments (Authenticated)
export async function createAuthenticatedAppointment(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ success: false, error: 'Request body must be a valid JSON object' });
      return;
    }

    const { property: propertyId, scheduledAt, notes, phone } = req.body;

    if (!propertyId || typeof propertyId !== 'string' || !mongoose.Types.ObjectId.isValid(propertyId)) {
      res.status(400).json({ success: false, error: 'Valid property reference is required' });
      return;
    }

    if (phone !== undefined && typeof phone !== 'string') {
      res.status(400).json({ success: false, error: 'Phone must be a valid string' });
      return;
    }

    if (notes !== undefined && typeof notes !== 'string') {
      res.status(400).json({ success: false, error: 'Notes must be a valid string' });
      return;
    }

    if (!scheduledAt || typeof scheduledAt !== 'string') {
      res.status(400).json({ success: false, error: 'Scheduled viewing time is required and must be a valid date string' });
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      res.status(400).json({
        success: false,
        error: 'Scheduled viewing time must be a valid future date and time',
      });
      return;
    }

    const maxFutureDate = Date.now() + 365 * 24 * 60 * 60 * 1000;
    if (scheduledDate.getTime() > maxFutureDate) {
      res.status(400).json({
        success: false,
        error: 'Viewing appointments cannot be scheduled more than 1 year in advance',
      });
      return;
    }

    if (phone && phone.trim().length > 30) {
      res.status(400).json({ success: false, error: 'Phone cannot exceed 30 characters' });
      return;
    }

    if (notes && notes.trim().length > 1000) {
      res.status(400).json({ success: false, error: 'Notes cannot exceed 1000 characters' });
      return;
    }

    const property = await Property.findById(propertyId);
    if (!property || property.status !== 'published') {
      res.status(404).json({
        success: false,
        error: 'Property is not available for booking',
      });
      return;
    }

    // Property owners cannot book viewings on their own properties
    if (property.owner.toString() === req.user.id) {
      res.status(400).json({
        success: false,
        error: 'You cannot schedule a viewing appointment for your own property listing',
      });
      return;
    }

    // Check for existing pending appointment by same user on this property
    const existingBooking = await Appointment.findOne({
      property: property._id,
      user: req.user.id,
      status: 'pending',
    });
    if (existingBooking) {
      res.status(409).json({
        success: false,
        error: 'You already have an active viewing appointment requested for this property.',
      });
      return;
    }

    const thumbnail =
      property.images && property.images.length > 0 && property.images[0]?.url
        ? property.images[0].url
        : undefined;

    let appointment;
    try {
      appointment = await Appointment.create({
        property: property._id,
        user: req.user.id,
        guestName: req.user.name,
        guestEmail: req.user.email,
        guestPhone: phone ? phone.trim() : undefined,
        scheduledAt: scheduledDate,
        status: 'pending',
        notes: notes ? notes.trim() : undefined,
        propertyTitle: property.title,
        propertyCity: property.city,
        propertyThumbnail: thumbnail,
        propertyPrice: property.price,
        propertyOwner: property.owner,
      });
    } catch (createErr: any) {
      if (createErr.code === 11000) {
        res.status(409).json({
          success: false,
          error: 'You already have an active viewing appointment requested for this property.',
        });
        return;
      }
      throw createErr;
    }

    res.status(201).json({
      success: true,
      data: appointment,
      message: 'Viewing appointment scheduled successfully!',
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/appointments/:id/status
export async function updateAppointmentStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ success: false, error: 'Request body must be a valid JSON object' });
      return;
    }

    const { status } = req.body;

    const allowedStatuses: AppointmentStatus[] = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!status || typeof status !== 'string' || !allowedStatuses.includes(status as AppointmentStatus)) {
      res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
      });
      return;
    }

    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid appointment ID' });
      return;
    }

    const appointment = await Appointment.findById(id).populate('property', 'owner');
    if (!appointment) {
      res.status(404).json({ success: false, error: 'Appointment not found' });
      return;
    }

    const isPropertyOwner =
      (appointment.property as any)?.owner?.toString() === req.user.id ||
      appointment.propertyOwner?.toString() === req.user.id;
    const isBooker =
      appointment.user?.toString() === req.user.id ||
      Boolean(appointment.guestEmail && appointment.guestEmail.toLowerCase() === req.user.email.toLowerCase());
    const isAdmin = req.user.role === 'admin';

    // Disallow reopening cancelled appointments unless admin
    if (appointment.status === 'cancelled' && status !== 'cancelled' && !isAdmin) {
      res.status(400).json({
        success: false,
        error: 'Cancelled appointments cannot be reopened. Please request a new viewing visit.',
      });
      return;
    }

    // Non-owners can only cancel their own appointment
    if (!isPropertyOwner && !isAdmin) {
      if (isBooker && status === 'cancelled') {
        appointment.status = 'cancelled';
        await appointment.save();
        res.status(200).json({ success: true, data: appointment, message: 'Appointment cancelled successfully' });
        return;
      }
      res.status(403).json({
        success: false,
        error: 'Forbidden: Only the property owner or administrator can modify appointment status',
      });
      return;
    }

    appointment.status = status as AppointmentStatus;
    await appointment.save();

    res.status(200).json({
      success: true,
      data: appointment,
      message: `Appointment status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/appointments/mine
export async function getMyAppointments(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // Return bookings made by current user, or bookings on properties owned by current user
    const userProperties = await Property.find({ owner: req.user.id }).select('_id');
    const userPropertyIds = userProperties.map((p) => p._id);

    const appointments = await Appointment.find({
      $or: [
        { user: req.user.id },
        { guestEmail: req.user.email },
        { propertyOwner: req.user.id },
        { property: { $in: userPropertyIds } },
      ],
    })
      .sort({ scheduledAt: -1 })
      .populate('property', 'title price city locality listingType propertyType images owner');

    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/appointments/:id/cancel
export async function cancelAppointment(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid appointment ID' });
      return;
    }

    const appointment = await Appointment.findById(id).populate('property', 'owner');

    if (!appointment) {
      res.status(404).json({ success: false, error: 'Appointment not found' });
      return;
    }

    const isBooker =
      appointment.user?.toString() === req.user.id ||
      Boolean(appointment.guestEmail && appointment.guestEmail.toLowerCase() === req.user.email.toLowerCase());
    const isPropertyOwner =
      (appointment.property as any)?.owner?.toString() === req.user.id ||
      appointment.propertyOwner?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isBooker && !isPropertyOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to cancel this appointment',
      });
      return;
    }

    if (appointment.status === 'cancelled') {
      res.status(400).json({
        success: false,
        error: 'This appointment is already cancelled',
      });
      return;
    }

    if (appointment.status === 'completed') {
      res.status(400).json({
        success: false,
        error: 'Completed viewing appointments cannot be cancelled',
      });
      return;
    }

    appointment.status = 'cancelled';
    await appointment.save();

    res.status(200).json({
      success: true,
      data: appointment,
      message: 'Viewing appointment cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
}
