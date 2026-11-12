ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Backfill existing milestones deterministically per contract
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY contract_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.milestones
  WHERE sort_order IS NULL
)
UPDATE public.milestones m
SET sort_order = n.rn
FROM numbered n
WHERE m.id = n.id;

CREATE INDEX IF NOT EXISTS idx_milestones_contract_sort_order
  ON public.milestones (contract_id, sort_order, created_at);

