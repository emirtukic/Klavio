-- Migration 011: let a ticket message (customer or staff) carry one image
-- attachment, stored on the reply row itself so it stays in that ticket's
-- thread forever, same as the message text.

ALTER TABLE support_ticket_replies
  ADD COLUMN attachment_url VARCHAR(500) NULL,
  ADD COLUMN attachment_filename VARCHAR(255) NULL;
