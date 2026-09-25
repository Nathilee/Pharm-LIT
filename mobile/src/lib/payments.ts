import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { api } from './api';
import type { Order } from './types';

/**
 * Pay for an order with Paystack (Mobile Money or card).
 *
 * Native: opens Paystack's secure checkout in an in-app browser and returns when the
 * customer is redirected back to the app. Web: navigates to checkout and Paystack
 * redirects back to /order/:id?reference=…, where the order screen verifies it.
 *
 * Resolves with the verified order, or null if the page navigated away (web).
 */
export async function payForOrder(orderId: number): Promise<{ order: Order; paid: boolean } | null> {
  const returnUrl =
    Platform.OS === 'web' ? `${window.location.origin}/order/${orderId}` : Linking.createURL(`/order/${orderId}`);

  const { authorizationUrl, reference } = await api<{ authorizationUrl: string; reference: string }>(
    'POST',
    '/api/payments/paystack/initialize',
    { orderId, returnUrl },
  );

  if (Platform.OS === 'web') {
    window.location.assign(authorizationUrl);
    return null;
  }

  await WebBrowser.openAuthSessionAsync(authorizationUrl, returnUrl);
  // Whether the customer finished or closed the sheet, ask the server for the truth.
  return verifyPayment(reference);
}

export function verifyPayment(reference: string) {
  return api<{ order: Order; paid: boolean }>('GET', `/api/payments/paystack/verify/${encodeURIComponent(reference)}`);
}
