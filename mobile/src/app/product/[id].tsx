import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ProductCard, ProductThumb, RxBadge } from '@/components/product';
import { Badge, Button, Card, ErrorView, KeyValue, Loading, Notice, QuantityStepper, Row, Screen, SectionTitle, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart';
import { money } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import type { Product } from '@/lib/types';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<{ product: Product; related: Product[] }>(`/api/products/${id}`);
  const cart = useCart();
  const [qty, setQty] = useState(1);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Not found'} onRetry={reload} />;
  const p = data.product;
  const inCart = cart.quantityOf(p.id);
  const maxAdd = Math.max(0, p.stock - inCart);

  const details: [string, string | null][] = [
    ['Generic name', p.genericName],
    ['Strength', p.strength],
    ['Form', p.dosageForm],
    ['Pack size', p.packSize],
    ['Manufacturer', p.manufacturer],
    ['Category', p.categoryName ?? null],
  ];

  return (
    <Screen
      footer={
        p.stock > 0 ? (
          <Row gap={Spacing.md}>
            <QuantityStepper value={qty} max={Math.max(1, maxAdd)} onChange={(n) => setQty(Math.max(1, n))} />
            <Button
              title={maxAdd === 0 ? 'Max in cart' : `Add · ${money(p.price * qty)}`}
              icon="cart"
              disabled={maxAdd === 0}
              style={{ flex: 1 }}
              onPress={() => {
                cart.add(p, Math.min(qty, maxAdd));
                setQty(1);
              }}
            />
          </Row>
        ) : (
          <Button title="Out of stock" disabled variant="outline" />
        )
      }>
      <Stack.Screen options={{ title: p.name }} />
      <Card style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
        <ProductThumb product={p} size={140} />
      </Card>

      <View style={{ marginTop: Spacing.lg, gap: 6 }}>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {p.requiresPrescription ? <RxBadge /> : <Badge label="Over the counter" tone="success" />}
          {p.stock === 0 ? (
            <Badge label="Out of stock" tone="danger" />
          ) : p.stock <= 10 ? (
            <Badge label={`Only ${p.stock} left`} tone="warning" />
          ) : (
            <Badge label="In stock" tone="info" />
          )}
        </Row>
        <T variant="h1">{p.name}</T>
        <T variant="price" style={{ fontSize: 22 }}>{money(p.price)}</T>
        {inCart > 0 ? (
          <Button
            title={`${inCart} in your cart · View cart`}
            variant="ghost"
            size="sm"
            icon="cart-outline"
            style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
            onPress={() => router.push('/cart')}
          />
        ) : null}
      </View>

      {p.requiresPrescription ? (
        <View style={{ marginTop: Spacing.md }}>
          <Notice tone="warning" icon="document-text" title="Prescription required">
            You can add this to your cart, then upload a photo of a valid prescription at checkout. A pharmacist will check it before dispatch.
          </Notice>
        </View>
      ) : null}

      {p.description ? (
        <>
          <SectionTitle title="About this product" />
          <T variant="body" style={{ color: Colors.textMuted }}>{p.description}</T>
        </>
      ) : null}

      <SectionTitle title="Details" />
      <Card style={{ paddingVertical: Spacing.sm }}>
        {details
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <KeyValue key={k} label={k} value={v as string} />
          ))}
      </Card>

      <View style={{ marginTop: Spacing.md }}>
        <Notice tone="neutral" icon="medical">
          Always read the label and follow the dosage instructions. Ask our pharmacist if you are pregnant, breastfeeding or taking other medicines.
        </Notice>
      </View>

      {data.related.length ? (
        <>
          <SectionTitle title="You may also need" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.related}>
            {data.related.map((r) => (
              <View key={r.id} style={{ width: 170 }}>
                <ProductCard product={r} />
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  related: { gap: Spacing.md, paddingBottom: Spacing.md },
});
