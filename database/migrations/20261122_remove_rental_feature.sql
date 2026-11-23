-- ============================================================================
-- MAJESTIC BLAZER: COMPLETE RENTAL FEATURE REMOVAL MIGRATION
-- Target: Drop rental-specific tables, columns, enums, indexes, and settings
-- Preservation: Strictly preserves all 56 payment and 64 invoice rows, users, orders, and retail inventory
-- ============================================================================

BEGIN;

-- 1. Remove inbound foreign-key dependencies on rental_bookings from shared financial tables
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_rental_booking_id_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_rental_booking_id_fkey;

-- 2. Set historical rental_booking_id references to NULL in payments and invoices
UPDATE payments SET rental_booking_id = NULL WHERE rental_booking_id IS NOT NULL;
UPDATE invoices SET rental_booking_id = NULL WHERE rental_booking_id IS NOT NULL;

-- 3. Drop the rental_bookings table (indexes dropped automatically with table)
DROP TABLE IF EXISTS rental_bookings;

-- 4. Drop rental_status enum type
DROP TYPE IF EXISTS rental_status;

-- 5. Remove rental-only product columns
ALTER TABLE products 
  DROP COLUMN IF EXISTS is_rentable,
  DROP COLUMN IF EXISTS rent_price_per_day,
  DROP COLUMN IF EXISTS security_deposit;

-- 6. Remove rental_stock_quantity from product_variants
ALTER TABLE product_variants 
  DROP COLUMN IF EXISTS rental_stock_quantity;

-- 7. Remove obsolete rental_booking_id columns from payments and invoices
ALTER TABLE payments DROP COLUMN IF EXISTS rental_booking_id;
ALTER TABLE invoices DROP COLUMN IF EXISTS rental_booking_id;

-- 8. Delete only the six explicitly identified rental configuration keys from settings and store_settings
DELETE FROM store_settings WHERE key IN ('rental_late_fee_per_day', 'rental_min_days', 'rental_max_days');
DELETE FROM settings WHERE key IN ('rental_late_fee_per_day', 'rental_min_days', 'rental_max_days');

COMMIT;
