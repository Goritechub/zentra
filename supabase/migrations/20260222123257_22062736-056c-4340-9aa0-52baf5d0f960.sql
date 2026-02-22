
-- Table to track hidden/archived conversations per user (for decluttering messages view)
CREATE TABLE public.hidden_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, contract_id)
);

ALTER TABLE public.hidden_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hidden conversations"
  ON public.hidden_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can hide conversations"
  ON public.hidden_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unhide conversations"
  ON public.hidden_conversations FOR DELETE
  USING (auth.uid() = user_id);
