import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Grid } from '@/components/grid';
import { ProductCard } from '@/components/product';
import { ErrorView, IconName, Ionicons, Loading, Row, SectionTitle, T } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useApi } from '@/lib/use-api';
import type { Category, Product } from '@/lib/types';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const cats = useApi<{ categories: Category[] }>('/api/categories');
  const featured = useApi<{ products: Product[] }>('/api/products?featured=true');

  const search = () => {
    router.push({ pathname: '/shop', params: q.trim() ? { q: q.trim() } : {} });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={{ alignItems: 'center' }}>
      <View style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.inner}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={10}>
              <View style={styles.logo}>
                <Ionicons name="medkit" size={20} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.brand}>Pharm-LIT</Text>
                <Text style={styles.heroSub}>{user ? `Hello, ${user.name.split(' ')[0]} 👋` : 'Your online pharmacy'}</Text>
              </View>
            </Row>
            <Link href="/prescriptions" asChild>
              <Pressable style={styles.heroIconBtn} accessibilityLabel="My prescriptions">
                <Ionicons name="document-text-outline" size={22} color={Colors.white} />
              </Pressable>
            </Link>
          </Row>

          <Text style={styles.heroTitle}>Genuine medicines,{'\n'}delivered to your door.</Text>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={Colors.textMuted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              onSubmitEditing={search}
              returnKeyType="search"
              placeholder="Search medicines, e.g. paracetamol"
              placeholderTextColor="#98A2B3"
              style={styles.searchInput}
            />
            <Pressable onPress={search} style={styles.searchBtn} accessibilityLabel="Search">
              <Ionicons name="arrow-forward" size={18} color={Colors.white} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.inner}>
        <Link href="/prescriptions" asChild>
          <Pressable style={styles.rxBanner}>
            <View style={styles.rxIcon}>
              <Ionicons name="camera" size={24} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="h3">Have a prescription?</T>
              <T variant="small">Snap a photo and a licensed pharmacist will review it.</T>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </Pressable>
        </Link>

        <SectionTitle title="Shop by category" action={<Link href="/shop" style={styles.link}>See all</Link>} />
        {cats.loading ? (
          <Loading />
        ) : cats.error ? (
          <ErrorView message={cats.error} onRetry={cats.reload} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.md }}>
            {cats.data?.categories.map((c) => (
              <Link key={c.id} href={{ pathname: '/shop', params: { category: c.slug } }} asChild>
                <Pressable style={styles.cat}>
                  <View style={[styles.catIcon, { backgroundColor: c.color + '1A' }]}>
                    <Ionicons name={c.icon as IconName} size={26} color={c.color} />
                  </View>
                  <Text style={styles.catText} numberOfLines={2}>
                    {c.name}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        )}

        <SectionTitle title="Popular right now" />
        {featured.loading ? (
          <Loading />
        ) : featured.error ? (
          <ErrorView message={featured.error} onRetry={featured.reload} />
        ) : (
          <Grid>
            {featured.data?.products.map((p) => <ProductCard key={p.id} product={p} />)}
          </Grid>
        )}

        <View style={styles.trust}>
          {[
            { icon: 'shield-checkmark', title: 'Licensed pharmacy', text: 'Genuine, approved medicines' },
            { icon: 'bicycle', title: 'Fast delivery', text: 'Same-day across Accra' },
            { icon: 'phone-portrait', title: 'Mobile Money', text: 'MTN, Telecel & AirtelTigo' },
          ].map((f) => (
            <View key={f.title} style={styles.trustItem}>
              <Ionicons name={f.icon as IconName} size={22} color={Colors.primary} />
              <T variant="h3" style={{ fontSize: 13, textAlign: 'center' }}>{f.title}</T>
              <T variant="small" style={{ textAlign: 'center' }}>{f.text}</T>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: 'center',
  },
  inner: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  brand: { color: Colors.white, fontSize: 20, fontWeight: '800' },
  heroSub: { color: '#D1FAE5', fontSize: 13 },
  heroIconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: Colors.white, fontSize: 26, fontWeight: '800', marginTop: Spacing.xl, marginBottom: Spacing.lg, lineHeight: 32 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    paddingLeft: Spacing.md,
    paddingRight: 6,
    height: 52,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 16, color: Colors.text, height: '100%' },
  searchBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  rxBanner: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  rxIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  link: { color: Colors.primaryDark, fontWeight: '700', fontSize: 14 },
  cat: { width: 92, alignItems: 'center', gap: 6 },
  catIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  catText: { fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  trust: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
