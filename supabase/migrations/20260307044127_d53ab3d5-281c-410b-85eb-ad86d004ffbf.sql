
-- Allow everyone to see published winner entries regardless of contest visibility
CREATE POLICY "Published winners viewable by everyone"
ON public.contest_entries
FOR SELECT
TO authenticated
USING (is_winner = true);
