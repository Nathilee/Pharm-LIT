import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Ionicons, IconName, QuantityStepper, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart';
import { money } from '@/lib/format';
import type { Product } from '@/lib/types';

export function ProductThumb({
  product,
  size = 64,
}: {
  product: Pick<Product, 'imageUrl' | 'categoryColor' | 'categoryIcon'>;
  size?: number;
}) {
  const color = product.categoryColor || Colors.primary;
  if (product.imageUrl) {
    return (
      <Image
        source={{ uri: product.imageUrl }}
        style={{ width: size, height: size, borderRadius: Radius.md, backgroundColor: '#fff' }}
        contentFit="contain"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Radius.md,
        backgroundColor: color + '1A',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={(product.categoryIcon as IconName) || 'medkit'} size={size * 0.45} color={color} />
    </View>
  );
}

export function RxBadge() {
  return <Badge label="Rx" tone="warning" icon="document-text" />;
}

export function AddToCartButton({ product, compact }: { product: Product; compact?: boolean }) {
  const cart = useCart();
  const qty = cart.quantityOf(product.id);
  if (product.stock === 0) {
    return <Badge label="Out of stock" tone="danger" />;
  }
  if (qty > 0) {
    return <QuantityStepper value={qty} max={product.stock} onChange={(n) => cart.setQuantity(product.id, n)} />;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${product.name} to cart`}
      onPress={() => cart.add(product)}
      style={({ pressed }) => [styles.addBtn, compact && styles.addBtnCompact, pressed && { opacity: 0.8 }]}>
      <Ionicons name="add" size={18} color={Colors.white} />
      {!compact ? <Text style={styles.addText}>Add</Text> : null}
    </Pressable>
  );
}

/** Grid tile used on Home / Shop. */
export function ProductCard({ product }: { product: Product }) {
  return (
    <View style={styles.card}>
      <Link href={{ pathname: '/product/[id]', params: { id: String(product.id) } }} asChild>
        <Pressable style={{ flex: 1 }}>
          <View style={styles.thumbWrap}>
            <ProductThumb product={product} size={72} />
            {product.requiresPrescription ? (
              <View style={styles.rxCorner}>
                <RxBadge />
              </View>
            ) : null}
          </View>
          <T variant="h3" numberOfLines={2} style={{ fontSize: 14, minHeight: 38 }}>
            {product.name}
          </T>
          <T variant="small" numberOfLines={1}>
            {[product.packSize, product.manufacturer].filter(Boolean).join(' · ')}
          </T>
        </Pressable>
      </Link>
      <Row style={{ justifyContent: 'space-between', marginTop: Spacing.sm }}>
        <T variant="price">{money(product.price)}</T>
        <AddToCartButton product={product} compact />
      </Row>
    </View>
  );
}

/** List row used in search results and admin. */
export function ProductRow({ product, right }: { product: Product; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Link href={{ pathname: '/product/[id]', params: { id: String(product.id) } }} asChild>
        <Pressable style={styles.rowMain}>
          <ProductThumb product={product} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="h3" numberOfLines={2} style={{ fontSize: 15 }}>
              {product.name}
            </T>
            <T variant="small" numberOfLines={1}>
              {[product.genericName, product.packSize].filter(Boolean).join(' · ')}
            </T>
            <Row gap={6}>
              <T variant="price" style={{ fontSize: 15 }}>
                {money(product.price)}
              </T>
              {product.requiresPrescription ? <RxBadge /> : null}
            </Row>
          </View>
        </Pressable>
      </Link>
      {right ?? <AddToCartButton product={product} compact />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    minWidth: 150,
  },
  thumbWrap: { alignItems: 'center', marginBottom: Spacing.sm, paddingVertical: Spacing.sm },
  rxCorner: { position: 'absolute', top: 0, right: 0 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    height: 38,
  },
  addBtnCompact: { width: 38, paddingHorizontal: 0, justifyContent: 'center' },
  addText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
});
