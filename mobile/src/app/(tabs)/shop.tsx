import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ProductRow } from '@/components/product';
import { Chip, EmptyState, ErrorView, Ionicons, Loading, Row, T } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useApi } from '@/lib/use-api';
import type { Category, Product } from '@/lib/types';

const SORTS = [
  { id: 'popular', label: 'Popular' },
  { id: 'price_asc', label: 'Price ↑' },
  { id: 'price_desc', label: 'Price ↓' },
  { id: 'name', label: 'A–Z' },
];

export default function ShopScreen() {
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [debounced, setDebounced] = useState(params.q ?? '');
  const [category, setCategory] = useState<string | undefined>(params.category);
  const [sort, setSort] = useState('popular');
  const [rx, setRx] = useState<'all' | 'otc' | 'rx'>('all');

  // Follow links from Home (search / category taps) — adjust state while rendering.
  const [prevParams, setPrevParams] = useState({ q: params.q, category: params.category });
  if (prevParams.q !== params.q || prevParams.category !== params.category) {
    setPrevParams({ q: params.q, category: params.category });
    if (params.q !== undefined && params.q !== prevParams.q) {
      setQuery(params.q);
      setDebounced(params.q);
    }
    if (params.category !== prevParams.category) setCategory(params.category);
  }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const path = useMemo(() => {
    const sp = new URLSearchParams();
    if (debounced) sp.set('q', debounced);
    if (category) sp.set('category', category);
    if (rx !== 'all') sp.set('rx', rx === 'rx' ? 'true' : 'false');
    sp.set('sort', sort);
    return `/api/products?${sp.toString()}`;
  }, [debounced, category, sort, rx]);

  const cats = useApi<{ categories: Category[] }>('/api/categories');
  const products = useApi<{ products: Product[] }>(path);

  const header = (
    <View style={{ gap: Spacing.md, paddingBottom: Spacing.md }}>
      <View style={styles.search}>
        <Ionicons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, generic name or brand"
          placeholderTextColor="#98A2B3"
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query ? <Ionicons name="close-circle" size={20} color={Colors.textMuted} onPress={() => setQuery('')} /> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
        <Chip label="All" selected={!category} onPress={() => setCategory(undefined)} />
        {cats.data?.categories.map((c) => (
          <Chip key={c.slug} label={c.name} selected={category === c.slug} onPress={() => setCategory(c.slug)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
        <Chip label="All medicines" selected={rx === 'all'} onPress={() => setRx('all')} />
        <Chip label="Over the counter" selected={rx === 'otc'} onPress={() => setRx('otc')} />
        <Chip label="Prescription" icon="document-text" selected={rx === 'rx'} onPress={() => setRx('rx')} />
        <View style={{ width: 1, backgroundColor: Colors.border, marginHorizontal: 4 }} />
        {SORTS.map((s) => (
          <Chip key={s.id} label={s.label} selected={sort === s.id} onPress={() => setSort(s.id)} />
        ))}
      </ScrollView>
      {products.data ? (
        <Row>
          <T variant="small">
            {products.data.products.length} product{products.data.products.length === 1 ? '' : 's'}
          </T>
        </Row>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center' }}>
      <FlatList
        style={{ width: '100%', maxWidth: MaxContentWidth }}
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm, flexGrow: 1 }}
        data={products.data?.products ?? []}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <ProductRow product={item} />}
        refreshing={products.refreshing}
        onRefresh={products.reload}
        ListEmptyComponent={
          products.loading ? (
            <Loading />
          ) : products.error ? (
            <ErrorView message={products.error} onRetry={products.reload} />
          ) : (
            <EmptyState
              icon="search"
              title="No medicines found"
              message="Try a different name or the generic name (e.g. “amoxicillin”)."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
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
});
