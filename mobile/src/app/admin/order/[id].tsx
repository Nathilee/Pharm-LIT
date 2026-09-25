import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { DeliveryCard, OrderItemsCard, OrderStatusBadge, OrderTimeline, PaymentBadge } from '@/components/order-bits';
import { Button, Card, ErrorView, Loading, Notice, Row, Screen, SectionTitle, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { confirmAsync, notify } from '@/lib/dialogs';
import { formatDate, ORDER_STATUS, RX_STATUS } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import type { Order, OrderStatus } from '@/lib/types';

export default function AdminOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setData, error, loading, reload, refreshing } = useApi<{ order: Order }>(`/api/orders/${id}`);
  const [busy, setBusy] = useState<OrderStatus | null>(null);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Not found'} onRetry={reload} />;
  const o = data.order;

  const move = async (status: OrderStatus) => {
    if (status === 'cancelled') {
      const ok = await confirmAsync(
        'Cancel this order?',
        o.paymentStatus === 'paid' ? 'The customer has paid — it will be marked as “refund due”.' : 'Stock will be returned.',
        'Cancel order',
        true,
      );
      if (!ok) return;
    }
    setBusy(status);
    try {
      const r = await api<{ order: Order }>('PATCH', `/api/admin/orders/${o.id}/status`, { status });
      setData(r);
    } catch (e: any) {
      notify('Could not update order', e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: `Order #${o.id}` }} />
      <Card>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <OrderStatusBadge order={o} />
          <PaymentBadge order={o} />
        </Row>
        <T variant="h2" style={{ marginTop: Spacing.sm }}>{ORDER_STATUS[o.status].label}</T>
        <T variant="muted">
          {o.customerName} · {o.customerEmail}
        </T>
        <T variant="small">
          {o.paymentMethod === 'paystack' ? 'Paystack (MoMo / card)' : 'Pay on delivery'}
          {o.paymentReference ? ` · Ref ${o.paymentReference}` : ''}
          {o.paidAt ? ` · Paid ${formatDate(o.paidAt)}` : ''}
        </T>
        <OrderTimeline order={o} />
      </Card>

      <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
        {o.status === 'processing' ? (
          <Button title="Mark as out for delivery" icon="bicycle" loading={busy === 'out_for_delivery'} onPress={() => move('out_for_delivery')} />
        ) : null}
        {o.status === 'out_for_delivery' ? (
          <Button
            title={o.paymentMethod === 'cash_on_delivery' ? 'Mark delivered & cash collected' : 'Mark as delivered'}
            icon="checkmark-done"
            loading={busy === 'delivered'}
            onPress={() => move('delivered')}
          />
        ) : null}
        {['processing', 'pending_payment', 'awaiting_prescription'].includes(o.status) ? (
          <Button title="Cancel order" variant="danger" icon="close-circle" loading={busy === 'cancelled'} onPress={() => move('cancelled')} />
        ) : null}
      </View>

      {o.prescriptionId ? (
        <View style={{ marginTop: Spacing.md }}>
          <Notice
            tone={o.prescriptionStatus ? RX_STATUS[o.prescriptionStatus].tone : 'neutral'}
            icon="document-text"
            title={`Prescription #${o.prescriptionId} — ${o.prescriptionStatus ? RX_STATUS[o.prescriptionStatus].label : ''}`}>
            <Link href="/admin/prescriptions" style={{ fontWeight: '700', marginTop: 4 }}>
              Open prescription review →
            </Link>
          </Notice>
        </View>
      ) : null}

      <SectionTitle title="Items to pack" />
      <OrderItemsCard order={o} />
      <SectionTitle title="Deliver to" />
      <DeliveryCard order={o} />
    </Screen>
  );
}
