import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ProductThumb, RxBadge } from '@/components/product';
import { Button, Card, Divider, EmptyState, Ionicons, KeyValue, Notice, QuantityStepper, Row, Screen, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useCart } from '@/context/cart';
import { money } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import type { StoreSettings } from '@/lib/types';

export default function CartScreen() {
  const cart = useCart();
  const { user, loading: authLoading } = useAuth();
  const settings = useApi<StoreSettings>('/api/orders/settings').data;

  if (cart.lines.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          message="Browse our pharmacy and add the medicines you need."
          action={<Button title="Start shopping" icon="grid" onPress={() => router.push('/shop')} />}
        />
      </Screen>
    );
  }

  const fee = settings
    ? cart.subtotal >= settings.freeDeliveryThreshold
      ? 0
      : settings.deliveryFee
    : null;
  const toFree = settings ? settings.freeDeliveryThreshold - cart.subtotal : 0;

  const checkout = () => {
    if (!user && !authLoading) router.push({ pathname: '/login', params: { next: '/checkout' } });
    else router.push('/checkout');
  };

  return (
    <Screen
      footer={
        <Button
          title={`Checkout · ${money(cart.subtotal + (fee ?? 0))}`}
          icon="lock-closed"
          onPress={checkout}
        />
      }>
      <View style={{ gap: Spacing.sm }}>
        {cart.lines.map(({ product, quantity }) => (
          <Card key={product.id} style={{ padding: Spacing.md }}>
            <Row gap={Spacing.md} style={{ alignItems: 'flex-start' }}>
              <Pressable onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(product.id) } })}>
                <ProductThumb product={product} size={60} />
              </Pressable>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="h3" numberOfLines={2} style={{ fontSize: 15 }}>{product.name}</T>
                <T variant="small">{[product.strength, product.packSize].filter(Boolean).join(' · ')}</T>
                {product.requiresPrescription ? <RxBadge /> : null}
                <Row style={{ justifyContent: 'space-between', marginTop: Spacing.sm }}>
                  <QuantityStepper
                    value={quantity}
                    max={product.stock}
                    onChange={(n) => cart.setQuantity(product.id, n)}
                  />
                  <T variant="price">{money(product.price * quantity)}</T>
                </Row>
              </View>
              <Pressable accessibilityLabel="Remove" hitSlop={10} onPress={() => cart.remove(product.id)}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </Pressable>
            </Row>
          </Card>
        ))}
      </View>

      {cart.requiresPrescription ? (
        <View style={{ marginTop: Spacing.md }}>
          <Notice tone="warning" icon="document-text" title="Prescription needed">
            Some items need a valid prescription. You’ll be asked to upload a photo of it at checkout.
          </Notice>
        </View>
      ) : null}

      {settings && toFree > 0 ? (
        <View style={{ marginTop: Spacing.md }}>
          <Notice tone="info" icon="bicycle">
            {`Add ${money(toFree)} more for FREE delivery.`}
          </Notice>
        </View>
      ) : null}

      <Card style={{ marginTop: Spacing.md }}>
        <KeyValue label={`Subtotal (${cart.count} item${cart.count === 1 ? '' : 's'})`} value={money(cart.subtotal)} />
        <KeyValue label="Delivery" value={fee === null ? '—' : fee === 0 ? 'FREE' : money(fee)} />
        <Divider />
        <KeyValue label="Total" value={money(cart.subtotal + (fee ?? 0))} bold />
      </Card>
      <Button title="Clear cart" variant="ghost" size="sm" onPress={cart.clear} style={{ marginTop: Spacing.sm, alignSelf: 'center' }} />
    </Screen>
  );
}
