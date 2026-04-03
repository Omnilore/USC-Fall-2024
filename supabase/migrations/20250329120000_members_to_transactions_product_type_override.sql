-- Per member–transaction line recharacterization (e.g. duplicate membership → donation).
ALTER TABLE members_to_transactions
ADD COLUMN IF NOT EXISTS product_type_override text NULL;

COMMENT ON COLUMN members_to_transactions.product_type_override IS
  'When set (MEMBERSHIP|FORUM|DONATION), reports and admin UI use this instead of products.type for the SKU.';
