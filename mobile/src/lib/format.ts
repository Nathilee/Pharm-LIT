import type { OrderStatus, PaymentStatus, PrescriptionStatus } from './types';

export function money(minor: number, currency = 'GHS') {
  const symbol = currency === 'GHS' ? 'GH₵' : currency + ' ';
  const value = (minor / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${value}`;
}

export function formatDate(iso: string | null | undefined, withTime = true) {
  if (!iso) return '';
  // SQLite datetime('now') is UTC without a zone marker.
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone; help: string }> = {
  awaiting_prescription: {
    label: 'Awaiting prescription check',
    tone: 'warning',
    help: 'A pharmacist is reviewing your prescription. You will be able to pay once it is approved.',
  },
  pending_payment: { label: 'Awaiting payment', tone: 'warning', help: 'Complete payment so we can prepare your order.' },
  processing: { label: 'Being prepared', tone: 'info', help: 'Our pharmacists are packing your order.' },
  out_for_delivery: { label: 'Out for delivery', tone: 'info', help: 'Your order is on its way.' },
  delivered: { label: 'Delivered', tone: 'success', help: 'Your order has been delivered. Get well soon!' },
  cancelled: { label: 'Cancelled', tone: 'danger', help: 'This order was cancelled.' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: 'Unpaid', tone: 'neutral' },
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Payment failed', tone: 'danger' },
  refunded: { label: 'Refund due', tone: 'warning' },
};

export const RX_STATUS: Record<PrescriptionStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Under review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export const ORDER_STEPS: OrderStatus[] = ['processing', 'out_for_delivery', 'delivered'];
