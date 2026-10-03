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
  gateway_provider?: string;
  invoice_url?: string;
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
    method?: string;
    gateway?: string;
  };
  abacatepay_billing_id?: string;
  invoices: BillingInvoice[];
}

export interface CheckoutPayload {
  tier: 'free' | 'pro' | 'enterprise';
  interval: 'monthly' | 'annual';
  payment_method_type?: 'credit_card' | 'pix';
  payment_details?: {
    last4?: string;
    brand?: string;
    holder_name?: string;
  };
}

export interface CheckoutResponse {
  success: boolean;
  message: string;
  tier: string;
  plan_name: string;
  checkout_url?: string;
  billing_id?: string;
  amount_brl?: number;
  is_sandbox?: boolean;
  is_free?: boolean;
  current_period_end?: string;
}

export interface SyncBillingResponse {
  synced: boolean;
  status: string;
  tier: string;
  plan_name: string;
  billing_interval?: string;
  receipt_code?: string;
  amount_brl?: number;
  monthly_token_quota?: number;
  message: string;
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

  async syncBilling(billingId?: string): Promise<SyncBillingResponse> {
    const response = await api.post('/api/v2/studio/billing/sync/', {
      billing_id: billingId,
    });
    return response.data;
  },

  async checkout(payload: CheckoutPayload): Promise<CheckoutResponse> {
    const response = await api.post('/api/v2/studio/billing/checkout/', payload);
    return response.data;
  },

  async confirmSandbox(payload: { tier: string; interval: string; billing_id?: string }): Promise<CheckoutResponse> {
    const response = await api.post('/api/v2/studio/billing/sandbox-confirm/', payload);
    return response.data;
  },

  async cancelSubscription(immediate: boolean = false): Promise<{
    success: boolean;
    message: string;
    cancel_at_period_end: boolean;
    immediate?: boolean;
    tier?: string;
    plan_name?: string;
    current_period_end: string | null;
  }> {
    const response = await api.post('/api/v2/studio/billing/cancel/', { immediate });
    return response.data;
  },

  async reactivateSubscription(): Promise<{
    success: boolean;
    message: string;
    cancel_at_period_end: boolean;
    tier?: string;
    plan_name?: string;
    current_period_end: string | null;
  }> {
    const response = await api.post('/api/v2/studio/billing/reactivate/');
    return response.data;
  },

  notifySubscriptionUpdated(): void {
    window.dispatchEvent(new CustomEvent('catana:subscription-updated'));
  },
};


