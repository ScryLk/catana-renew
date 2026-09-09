import api from './api';

export interface BillingPlan {
  id: number;
  tier: 'free' | 'pro' | 'enterprise';
  name: string;
  description: string;
  price_monthly_brl: number;
  price_annual_brl: number;
  is_popular: boolean;
  monthly_token_quota: number;
  max_active_catalogs: number;
  rate_limit_rpm: number;
  can_use_council: boolean;
  can_export_pdf: boolean;
  features: string[];
}

export interface BillingInvoice {
  id: number;
  receipt_code: string;
  plan_name: string;
  amount_brl: number;
  billing_interval: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  payment_method_type: string;
  payment_method_summary: string;
  paid_at: string | null;
}

export interface SubscriptionInfo {
  status: string;
  billing_interval: 'monthly' | 'annual';
  tier: string;
  plan_name: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  payment_method_type: string;
  payment_method_details: {
    last4?: string;
    brand?: string;
    holder_name?: string;
    pix_key_type?: string;
    status?: string;
  };
  invoices: BillingInvoice[];
}

export interface CheckoutPayload {
  tier: 'free' | 'pro' | 'enterprise';
  interval: 'monthly' | 'annual';
  payment_method_type: 'credit_card' | 'pix';
  payment_details?: {
    last4?: string;
    brand?: string;
    holder_name?: string;
  };
}

export const billingService = {
  async getPlans(): Promise<BillingPlan[]> {
    const response = await api.get('/api/v2/studio/billing/plans/');
    return response.data.plans;
  },

  async getSubscription(): Promise<SubscriptionInfo> {
    const response = await api.get('/api/v2/studio/billing/subscription/');
    return response.data;
  },

  async checkout(payload: CheckoutPayload): Promise<{
    success: boolean;
    message: string;
    tier: string;
    plan_name: string;
    receipt_code: string;
    amount_brl: number;
    current_period_end: string;
  }> {
    const response = await api.post('/api/v2/studio/billing/checkout/', payload);
    return response.data;
  },

  async cancelSubscription(): Promise<{
    success: boolean;
    message: string;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
  }> {
    const response = await api.post('/api/v2/studio/billing/cancel/');
    return response.data;
  },
};
