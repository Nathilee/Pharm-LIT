import { StyleSheet, View } from 'react-native';

import { Badge, Card, Divider, Ionicons, KeyValue, Row, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { formatDate, money, ORDER_STATUS, ORDER_STEPS, PAYMENT_STATUS } from '@/lib/format';
import type { Order } from '@/lib/types';

export function OrderStatusBadge({ order }: { order: Pick<Order, 'status'> }) {
  const s = ORDER_STATUS[order.status];
  return <Badge label={s.label} tone={s.tone} />;
}

export function PaymentBadge({ order }: { order: Pick<Order, 'paymentStatus' | 'paymentMethod'> }) {
  const s = PAYMENT_STATUS[order.paymentStatus];
  const label = order.paymentMethod === 'cash_on_delivery' && order.paymentStatus === 'unpaid' ? 'Pay on delivery' : s.label;
  return <Badge label={label} tone={s.tone} icon={order.paymentStatus === 'paid' ? 'checkmark-circle' : undefined} />;
}

/** Processing → Out for delivery → Delivered progress bar. */
export function OrderTimeline({ order }: { order: Order }) {
  if (order.status === 'cancelled') return null;
  const idx = ORDER_STEPS.indexOf(order.status);
  const labels = ['Preparing', 'On the way', 'Delivered'];
  return (
    <Row gap={0} style={{ marginTop: Spacing.md }}>
      {ORDER_STEPS.map((step, i) => {
        const done = idx >= i;
        return (
          <View key={step} style={{ flex: 1, alignItems: 'center' }}>
            <Row gap={0} style={{ width: '100%' }}>
              <View style={[styles.line, { opacity: i === 0 ? 0 : 1 }, done && styles.lineDone]} />
              <View style={[styles.dot, done && styles.dotDone]}>
                {done ? <Ionicons name="checkmark" size={12} color={Colors.white} /> : null}
              </View>
              <View style={[styles.line, { opacity: i === ORDER_STEPS.length - 1 ? 0 : 1 }, idx > i && styles.lineDone]} />
            </Row>
            <T variant="small" style={{ marginTop: 4, fontWeight: done ? '700' : '400', color: done ? Colors.text : Colors.textMuted }}>
              {labels[i]}
            </T>
          </View>
        );
      })}
    </Row>
  );
}

export function OrderItemsCard({ order }: { order: Order }) {
  return (
    <Card>
      {order.items.map((i) => (
        <Row key={i.id} style={{ justifyContent: 'space-between', paddingVertical: 4, alignItems: 'flex-start' }}>
          <T variant="body" style={{ flex: 1 }}>
            {i.quantity} × {i.name}
            {i.requiresPrescription ? <T variant="small">  (Rx)</T> : null}
          </T>
          <T variant="body">{money(i.unitPrice * i.quantity)}</T>
        </Row>
      ))}
      <Divider />
      <KeyValue label="Subtotal" value={money(order.subtotal)} />
      <KeyValue label="Delivery" value={order.deliveryFee === 0 ? 'FREE' : money(order.deliveryFee)} />
      <Divider />
      <KeyValue label="Total" value={money(order.total)} bold />
    </Card>
  );
}

export function DeliveryCard({ order }: { order: Order }) {
  return (
    <Card style={{ gap: 6 }}>
      <Row>
        <Ionicons name="person-outline" size={18} color={Colors.textMuted} />
        <T variant="body">{order.deliveryName}</T>
      </Row>
      <Row>
        <Ionicons name="call-outline" size={18} color={Colors.textMuted} />
        <T variant="body">{order.deliveryPhone}</T>
      </Row>
      <Row style={{ alignItems: 'flex-start' }}>
        <Ionicons name="location-outline" size={18} color={Colors.textMuted} />
        <T variant="body" style={{ flex: 1 }}>{order.deliveryAddress}</T>
      </Row>
      {order.notes ? (
        <Row style={{ alignItems: 'flex-start' }}>
          <Ionicons name="chatbubble-outline" size={18} color={Colors.textMuted} />
          <T variant="muted" style={{ flex: 1 }}>{order.notes}</T>
        </Row>
      ) : null}
      <T variant="small" style={{ marginTop: 4 }}>Placed {formatDate(order.createdAt)}</T>
    </Card>
  );
}

const styles = StyleSheet.create({
  line: { flex: 1, height: 3, backgroundColor: Colors.border },
  lineDone: { backgroundColor: Colors.primary },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: Colors.primary },
});
