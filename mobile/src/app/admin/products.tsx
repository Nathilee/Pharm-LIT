import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ProductThumb, RxBadge } from '@/components/product';
import { Badge, Button, EmptyState, ErrorView, Ionicons, Loading, Row, Screen, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { notify } from '@/lib/dialogs';
import { money } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import type { Product } from '@/lib/types';

export default function AdminProducts() {
  const { isAdmin } = useAuth();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, setData, error, loading, reload, refreshing } = useApi<{ products: Product[] }>(
    `/api/admin/products${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`,
  );

  const adjustStock = async (p: Product, delta: number) => {
    const stock = Math.max(0, p.stock + delta);
    setData((d) => d && { products: d.products.map((x) => (x.id === p.id ? { ...x, stock } : x)) });
    try {
      await api('PATCH', `/api/admin/products/${p.id}`, { stock });
    } catch (e: any) {
      notify('Could not update stock', e.message);
      reload();
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Row style={{ marginBottom: Spacing.md }}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search products" placeholderTextColor="#98A2B3" style={styles.searchInput} />
        </View>
        {isAdmin ? (
          <Button title="New" icon="add" onPress={() => router.push({ pathname: '/admin/product/[id]', params: { id: 'new' } })} />
        ) : null}
      </Row>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data?.products.length ? (
        <View style={{ gap: Spacing.sm }}>
          {data.products.map((p) => (
            <View key={p.id} style={[styles.row, !p.active && { opacity: 0.55 }]}>
              <Link href={{ pathname: '/admin/product/[id]', params: { id: String(p.id) } }} asChild>
                <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  <ProductThumb product={p} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="h3" style={{ fontSize: 14 }} numberOfLines={1}>{p.name}</T>
                    <Row gap={6} style={{ flexWrap: 'wrap' }}>
                      <T variant="small">{money(p.price)}</T>
                      {p.requiresPrescription ? <RxBadge /> : null}
                      {!p.active ? <Badge label="Hidden" /> : null}
                      {p.stock === 0 ? <Badge label="Out" tone="danger" /> : p.stock <= 20 ? <Badge label="Low" tone="warning" /> : null}
                    </Row>
                  </View>
                </Pressable>
              </Link>
              <Row gap={0} style={styles.stock}>
                <Pressable style={styles.stockBtn} onPress={() => adjustStock(p, -1)} accessibilityLabel="Decrease stock">
                  <Ionicons name="remove" size={16} color={Colors.text} />
                </Pressable>
                <T style={{ minWidth: 36, textAlign: 'center', fontWeight: '700' }}>{p.stock}</T>
                <Pressable style={styles.stockBtn} onPress={() => adjustStock(p, 10)} accessibilityLabel="Add 10 to stock">
                  <T variant="small" style={{ fontWeight: '700', color: Colors.primaryDark }}>+10</T>
                </Pressable>
              </Row>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState icon="medkit-outline" title="No products found" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  searchInput: { flex: 1, fontSize: 16, color: Colors.text, height: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stock: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm },
  stockBtn: { width: 36, height: 34, alignItems: 'center', justifyContent: 'center' },
});
