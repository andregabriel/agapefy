-- Add is_visible flag and enforce unique positions for categories shown on home

-- 1) Column for visibility (default true)
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true;

UPDATE categories SET is_visible = true WHERE is_visible IS NULL;

-- 2) Backfill order_position for visible, non-featured categories to ensure uniqueness
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           ORDER BY COALESCE(order_position, 2147483647), created_at, name
         ) AS rn
  FROM categories
  WHERE COALESCE(is_visible, true) = true
    AND COALESCE(is_featured, false) = false
)
UPDATE categories c
SET order_position = o.rn
FROM ordered o
WHERE c.id = o.id;

-- 3) Create partial unique index: only for categories that appear on home (visible and not featured)
CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_home_position
ON categories (order_position)
WHERE (COALESCE(is_visible, true) = true AND COALESCE(is_featured, false) = false);

-- 4) Trigger to auto-assign next position when inserting/updating visible, non-featured categories
CREATE OR REPLACE FUNCTION assign_category_order_position()
RETURNS trigger AS $$
DECLARE
  next_pos integer;
BEGIN
  -- Only apply to records that should appear on home (visible and not featured)
  IF COALESCE(NEW.is_visible, true) = true AND COALESCE(NEW.is_featured, false) = false THEN
    IF NEW.order_position IS NULL THEN
      SELECT COALESCE(MAX(order_position), 0) + 1 INTO next_pos
      FROM categories
      WHERE COALESCE(is_visible, true) = true AND COALESCE(is_featured, false) = false;
      NEW.order_position := next_pos;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_category_order_position_ins ON categories;
DROP TRIGGER IF EXISTS trg_assign_category_order_position_upd ON categories;

CREATE TRIGGER trg_assign_category_order_position_ins
BEFORE INSERT ON categories
FOR EACH ROW EXECUTE FUNCTION assign_category_order_position();

CREATE TRIGGER trg_assign_category_order_position_upd
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION assign_category_order_position();

