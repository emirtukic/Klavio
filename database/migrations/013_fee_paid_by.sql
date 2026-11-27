ALTER TABLE membership_fees
  ADD COLUMN paid_by INT NULL AFTER payment_method,
  ADD FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE SET NULL;
