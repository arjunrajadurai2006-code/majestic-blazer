import * as Contact from '../models/contactModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const create = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    throw new AppError('Name, email, subject, and message are required', 400);
  }
  const enquiry = await Contact.create({ name, email, phone, subject, message });
  res.status(201).json({ success: true, data: enquiry, message: 'Your enquiry has been received. Our team will contact you shortly.' });
});

export const list = asyncHandler(async (req, res) => {
  const enquiries = await Contact.listAll();
  res.json({ success: true, data: enquiries });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const enquiry = await Contact.updateStatus(req.params.id, req.body);
  if (!enquiry) throw new AppError('Enquiry not found', 404);
  res.json({ success: true, data: enquiry });
});

