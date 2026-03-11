
-- Allow admins to delete contracts
CREATE POLICY "Admins can delete contracts"
ON public.contracts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete related milestones
CREATE POLICY "Admins can delete milestones"
ON public.milestones
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete related escrow_ledger
CREATE POLICY "Admins can delete escrow_ledger"
ON public.escrow_ledger
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete contract messages
CREATE POLICY "Admins can delete contract_messages"
ON public.contract_messages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete contract attachments
CREATE POLICY "Admins can delete contract_attachments"
ON public.contract_attachments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
