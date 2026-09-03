export interface BankDetail {
  id: string;
  user_id: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  recipient_code: string | null;
  is_default: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface PaystackBank {
  code: string;
  name: string;
}

export interface PaystackChargeData {
  url?: string;
  display_text?: string;
  gateway_response?: string;
}

export interface PaystackChargeResponse {
  success: boolean;
  error?: string;
  status: string;
  reference: string;
  data: PaystackChargeData;
}

export interface FlutterwaveCheckoutOptions {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options: string;
  customer: { email: string; name: string };
  meta: { user_id: string };
  customizations: { title: string; description: string };
  callback: (data: { status: string }) => void;
  onclose: () => void;
}
