import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { OrderRow } from '@/components/order-list';
import { Chip, EmptyState, ErrorView, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApi } from '@/lib/use-api';
import type { Order, OrderStatus } from '@/lib/types';

const FILTERS: { id: OrderStatus | 'all'; label: string }[] = [
  { id: 'processing', label: 'To pack' },
  { id: 'out_for_delivery', label: 'Out for delivery' },
  { id: 'awaiting_prescription', label: 'Awaiting Rx' },
  { id: 'pending_payment', label: 'Awaiting payment' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
];

export default function AdminOrders() {
  const [filter, setFilter] = useState<OrderStatus | 'all'>('processing');
  const { data, error, loading, reload, refreshing } = useApi<{ orders: Order[] }>(
    filter === 'all' ? '/api/admin/orders' : `/api/admin/orders?status=${filter}`,
  );

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.md }}>
        {FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </ScrollView>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data?.orders.length ? (
        <View style={{ gap: Spacing.sm }}>
          {data.orders.map((o) => (
            <OrderRow key={o.id} order={o} showCustomer href={{ pathname: '/admin/order/[id]', params: { id: String(o.id) } }} />
          ))}
        </View>
      ) : (
        <EmptyState icon="file-tray-outline" title="Nothing here" message="No orders with this status." />
      )}
    </Screen>
  );
}
