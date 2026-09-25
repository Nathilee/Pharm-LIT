import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { DeliveryCard, OrderItemsCard, OrderStatusBadge, OrderTimeline, PaymentBadge } from '@/components/order-bits';
import { Button, Card, ErrorView, Loading, Notice, Row, Screen, SectionTitle, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { confirmAsync, notify } from '@/lib/dialogs';
import { money, ORDER_STATUS, RX_STATUS } from '@/lib/format';
import { payForOrder, verifyPayment } from '@/lib/payments';
import { useApi } from '@/lib/use-api';
import type { Order } from '@/lib/types';

export default function OrderScreen() {
  const { id, placed, reference } = useLocalSearchParams<{ id: string; placed?: string; reference?: string }>();
  const { user, loading: authLoading } = useAuth();
  const { data, setData, error, loading, reload, refreshing } = useApi<{ order: Order }>(
    user ? `/api/orders/${id}` : null,
  );
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const verified = useRef(false);

  // Returning from Paystack on web: /order/12?reference=PL-12-xxxx
  useEffect(() => {
    if (!reference || !user || verified.current) return;
    verified.current = true;
    verifyPayment(reference)
      .then((r) => {
        setData({ order: r.order });
        setJustPaid(r.paid);
      })
      .catch(() => {})
      .finally(() => router.setParams({ reference: undefined, paid: undefined } as any));
  }, [reference, user, setData]);

  if (authLoading || (user && loading)) return <Loading />;
  if (!user) {
    return <ErrorView message="Please sign in to view this order." onRetry={() => router.push('/login')} />;
  }
  if (error || !data) return <ErrorView message={error ?? 'Order not found'} onRetry={reload} />;
  const order = data.order;
  const status = ORDER_STATUS[order.status];

  const pay = async () => {
    setPaying(true);
    try {
      const r = await payForOrder(order.id);
      if (r) {
        setData({ order: r.order });
        if (r.paid) setJustPaid(true);
        else notify('Payment not completed', 'You can try again whenever you are ready.');
      }
    } catch (e: any) {
      notify('Payment failed', e.message);
    } finally {
      setPaying(false);
    }
  };

  const cancel = async () => {
    const ok = await confirmAsync('Cancel this order?', 'Items will be returned to stock.', 'Cancel order', true);
    if (!ok) return;
    setCancelling(true);
    try {
      const r = await api<{ order: Order }>('POST', `/api/orders/${order.id}/cancel`);
      setData(r);
    } catch (e: any) {
      notify('Could not cancel', e.message);
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = ['awaiting_prescription', 'pending_payment'].includes(order.status) ||
    (order.status === 'processing' && order.paymentStatus !== 'paid');
  const canPay = order.status === 'pending_payment' && order.paymentMethod === 'paystack' && order.paymentStatus !== 'paid';

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={reload}
      footer={canPay ? <Button title={`Pay ${money(order.total)} with MoMo / Card`} icon="lock-closed" loading={paying} onPress={pay} /> : undefined}>
      <Stack.Screen options={{ title: `Order #${order.id}` }} />

      {justPaid ? (
        <View style={{ marginBottom: Spacing.md }}>
          <Notice tone="success" icon="checkmark-circle" title="Payment received">
            Thank you! Our pharmacists are preparing your order.
          </Notice>
        </View>
      ) : placed && !justPaid ? (
        <View style={{ marginBottom: Spacing.md }}>
          <Notice tone="success" icon="checkmark-circle" title="Order placed">
            {order.status === 'awaiting_prescription'
              ? 'We received your order and prescription. We’ll notify you here once a pharmacist approves it.'
              : 'Thanks for shopping with Pharm-LIT.'}
          </Notice>
        </View>
      ) : null}

      <Card>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <OrderStatusBadge order={order} />
          <PaymentBadge order={order} />
        </Row>
        <T variant="h2" style={{ marginTop: Spacing.sm }}>{status.label}</T>
        <T variant="muted">{status.help}</T>
        <OrderTimeline order={order} />
      </Card>

      {order.prescriptionId ? (
        <View style={{ marginTop: Spacing.md }}>
          <Notice
            tone={order.prescriptionStatus ? RX_STATUS[order.prescriptionStatus].tone : 'neutral'}
            icon="document-text"
            title={`Prescription #${order.prescriptionId}: ${order.prescriptionStatus ? RX_STATUS[order.prescriptionStatus].label : ''}`}>
            {order.prescriptionStatus === 'rejected'
              ? 'Your prescription could not be accepted. See “My prescriptions” for the pharmacist’s note.'
              : order.prescriptionStatus === 'pending'
                ? 'Pull down to refresh and check for updates.'
                : 'Verified by a licensed pharmacist.'}
          </Notice>
        </View>
      ) : null}

      <SectionTitle title="Items" />
      <OrderItemsCard order={order} />

      <SectionTitle title="Delivery" />
      <DeliveryCard order={order} />

      {order.paymentStatus === 'refunded' ? (
        <View style={{ marginTop: Spacing.md }}>
          <Notice tone="warning" icon="cash">
            This paid order was cancelled. Our team will refund your Mobile Money / card within 3 working days.
          </Notice>
        </View>
      ) : null}

      <View style={{ gap: Spacing.sm, marginTop: Spacing.lg }}>
        {canCancel ? <Button title="Cancel order" variant="danger" icon="close-circle" loading={cancelling} onPress={cancel} /> : null}
        <Button title="Continue shopping" variant="outline" icon="grid" onPress={() => router.replace('/shop')} />
      </View>
    </Screen>
  );
}
