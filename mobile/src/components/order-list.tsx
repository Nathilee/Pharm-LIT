import { Href, Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { OrderStatusBadge, PaymentBadge } from '@/components/order-bits';
import { Ionicons, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatDate, money } from '@/lib/format';
import type { Order } from '@/lib/types';

export function OrderRow({ order, href, showCustomer }: { order: Order; href: Href; showCustomer?: boolean }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.row}>
        <View style={{ flex: 1, gap: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h3">Order #{order.id}</T>
            <T variant="price">{money(order.total)}</T>
          </Row>
          <T variant="small" numberOfLines={1}>
            {showCustomer ? `${order.customerName} · ` : ''}
            {order.itemCount} item{order.itemCount === 1 ? '' : 's'} · {formatDate(order.createdAt)}
          </T>
          <T variant="small" numberOfLines={1} style={{ color: Colors.text }}>
            {order.items.map((i) => i.name).join(', ')}
          </T>
          <Row style={{ flexWrap: 'wrap', marginTop: 2 }}>
            <OrderStatusBadge order={order} />
            <PaymentBadge order={order} />
          </Row>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
