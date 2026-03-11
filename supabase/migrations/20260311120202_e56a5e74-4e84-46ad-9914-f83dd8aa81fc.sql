
-- Allow admins to delete hidden_conversations
CREATE POLICY "Admins can delete hidden_conversations"
ON public.hidden_conversations
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete escrow_transactions
CREATE POLICY "Admins can delete escrow_transactions"
ON public.escrow_transactions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete milestone_submissions
CREATE POLICY "Admins can delete milestone_submissions"
ON public.milestone_submissions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete disputes
CREATE POLICY "Admins can delete disputes"
ON public.disputes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete dispute_messages
CREATE POLICY "Admins can delete dispute_messages"
ON public.dispute_messages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete payout_transfers
CREATE POLICY "Admins can delete payout_transfers"
ON public.payout_transfers
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete reviews for contracts
CREATE POLICY "Admins can delete reviews via contract"
ON public.reviews
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
