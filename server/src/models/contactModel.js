import { pool } from '../config/db.js';

export const create = async ({ name, email, phone = null, subject, message }) => {
  const { rows } = await pool.query(
    `INSERT INTO contact_enquiries (name, email, phone, subject, message, status)
     VALUES ($1, $2, $3, $4, $5, 'new')
     RETURNING *`,
    [name.trim(), email.trim().toLowerCase(), phone ? phone.trim() : null, subject.trim(), message.trim()]
  );
  return rows[0];
};

export const listAll = async () => {
  const { rows } = await pool.query(
    'SELECT * FROM contact_enquiries ORDER BY created_at DESC'
  );
  return rows;
};

export const updateStatus = async (id, { status, replyNotes = null }) => {
  const { rows } = await pool.query(
    'UPDATE contact_enquiries SET status = $1, reply_notes = COALESCE($2, reply_notes) WHERE id = $3 RETURNING *',
    [status, replyNotes, id]
  );
  return rows[0] || null;
};

