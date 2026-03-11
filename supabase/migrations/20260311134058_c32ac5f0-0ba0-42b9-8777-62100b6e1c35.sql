-- Allow admins to delete wallet_transactions
CREATE POLICY "Admins can delete wallet_transactions"
ON public.wallet_transactions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete platform_revenue
CREATE POLICY "Admins can delete platform_revenue"
ON public.platform_revenue
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete paystack_references
CREATE POLICY "Admins can delete paystack_references"
ON public.paystack_references
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));