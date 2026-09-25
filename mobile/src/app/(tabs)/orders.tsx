import { router } from 'expo-router';
import { View } from 'react-native';

import { OrderRow } from '@/components/order-list';
import { Button, EmptyState, ErrorView, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useApi } from '@/lib/use-api';
import type { Order } from '@/lib/types';

export default function OrdersScreen() {
  const { user, loading: authLoading } = useAuth();
  const { data, error, loading, reload, refreshing } = useApi<{ orders: Order[] }>(user ? '/api/orders' : null);

  if (authLoading) return <Loading />;
  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="receipt-outline"
          title="Track your orders"
          message="Sign in to see your orders and delivery status."
          action={<Button title="Sign in" icon="log-in" onPress={() => router.push({ pathname: '/login', params: { next: '/orders' } })} />}
        />
      </Screen>
    );
  }
  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={reload} />;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      {data?.orders.length ? (
        <View style={{ gap: Spacing.sm }}>
          {data.orders.map((o) => (
            <OrderRow key={o.id} order={o} href={{ pathname: '/order/[id]', params: { id: String(o.id) } }} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="receipt-outline"
          title="No orders yet"
          message="When you place an order it will appear here."
          action={<Button title="Browse medicines" icon="grid" onPress={() => router.push('/shop')} />}
        />
      )}
    </Screen>
  );
}
