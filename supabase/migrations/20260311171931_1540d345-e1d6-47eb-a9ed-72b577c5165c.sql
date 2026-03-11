
-- Issue 2: Prevent users from changing their own role via profile updates
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Allow if the caller is an admin (via user_roles table)
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- For non-admins, force role to remain unchanged
  NEW.role := OLD.role;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_role_immutability
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.role IS DISTINCT FROM OLD.role)
  EXECUTE FUNCTION public.prevent_role_change();

-- Issue 3: Add ON DELETE CASCADE to all contract FK references that are missing it
ALTER TABLE public.hidden_conversations
  DROP CONSTRAINT hidden_conversations_contract_id_fkey,
  ADD CONSTRAINT hidden_conversations_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;

ALTER TABLE public.paystack_references
  DROP CONSTRAINT paystack_references_contract_id_fkey,
  ADD CONSTRAINT paystack_references_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;

ALTER TABLE public.platform_revenue
  DROP CONSTRAINT platform_revenue_contract_id_fkey,
  ADD CONSTRAINT platform_revenue_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;

ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT wallet_transactions_contract_id_fkey,
  ADD CONSTRAINT wallet_transactions_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;
