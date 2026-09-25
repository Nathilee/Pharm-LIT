import { Href, Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Grid } from '@/components/grid';
import { OrderRow } from '@/components/order-list';
import { ProductThumb } from '@/components/product';
import { Badge, Card, ErrorView, IconName, Ionicons, Loading, Row, Screen, SectionTitle, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { money } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import type { AdminStats } from '@/lib/types';

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const { data, error, loading, reload, refreshing } = useApi<AdminStats>('/api/admin/stats');

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed to load'} onRetry={reload} />;
  const s = data.ordersByStatus;
  const toPack = s.processing ?? 0;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Grid minItemWidth={190}>
        <Stat icon="cash" color={Colors.primary} label="Revenue (paid)" value={money(data.revenue)} sub={`${money(data.revenueToday)} today`} />
        <Stat icon="receipt" color={Colors.info} label="Orders" value={String(data.totalOrders)} sub={`${toPack} to pack`} />
        <Stat icon="document-text" color={Colors.accent} label="Rx to review" value={String(data.pendingPrescriptions)} sub="prescriptions" />
        <Stat icon="people" color="#7048E8" label="Customers" value={String(data.customers)} sub={`${data.products} products`} />
      </Grid>

      <SectionTitle title="Manage" />
      <View style={{ gap: Spacing.sm }}>
        <NavTile href="/admin/prescriptions" icon="document-text" label="Review prescriptions" count={data.pendingPrescriptions} />
        <NavTile href="/admin/orders" icon="cube" label="Orders & deliveries" count={toPack + (s.out_for_delivery ?? 0)} />
        <NavTile href="/admin/products" icon="medkit" label="Products & stock" count={data.lowStock.length} countTone="danger" />
        {isAdmin ? <NavTile href="/admin/users" icon="people" label="Users & staff roles" /> : null}
      </View>

      <SectionTitle title="Order pipeline" />
      <Card>
        <Row style={{ flexWrap: 'wrap', gap: Spacing.sm }}>
          <Badge label={`Awaiting Rx: ${s.awaiting_prescription ?? 0}`} tone="warning" />
          <Badge label={`Awaiting payment: ${s.pending_payment ?? 0}`} tone="warning" />
          <Badge label={`To pack: ${s.processing ?? 0}`} tone="info" />
          <Badge label={`Out for delivery: ${s.out_for_delivery ?? 0}`} tone="info" />
          <Badge label={`Delivered: ${s.delivered ?? 0}`} tone="success" />
          <Badge label={`Cancelled: ${s.cancelled ?? 0}`} tone="danger" />
        </Row>
      </Card>

      {data.lowStock.length ? (
        <>
          <SectionTitle title="Low stock" action={<Link href="/admin/products" style={styles.link}>Restock</Link>} />
          <Card style={{ gap: Spacing.sm }}>
            {data.lowStock.map((p) => (
              <Link key={p.id} href={{ pathname: '/admin/product/[id]', params: { id: String(p.id) } }} asChild>
                <Pressable>
                  <Row>
                    <ProductThumb product={p} size={36} />
                    <T style={{ flex: 1 }} numberOfLines={1}>{p.name}</T>
                    <Badge label={p.stock === 0 ? 'Out of stock' : `${p.stock} left`} tone={p.stock === 0 ? 'danger' : 'warning'} />
                  </Row>
                </Pressable>
              </Link>
            ))}
          </Card>
        </>
      ) : null}

      {data.topProducts.length ? (
        <>
          <SectionTitle title="Best sellers" />
          <Card>
            {data.topProducts.map((p, i) => (
              <Row key={p.name} style={{ paddingVertical: 4 }}>
                <T variant="muted" style={{ width: 20 }}>{i + 1}</T>
                <T style={{ flex: 1 }} numberOfLines={1}>{p.name}</T>
                <T variant="small">{p.quantity} sold</T>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle title="Recent orders" action={<Link href="/admin/orders" style={styles.link}>View all</Link>} />
      <View style={{ gap: Spacing.sm }}>
        {data.recentOrders.length ? (
          data.recentOrders.map((o) => (
            <OrderRow key={o.id} order={o} showCustomer href={{ pathname: '/admin/order/[id]', params: { id: String(o.id) } }} />
          ))
        ) : (
          <T variant="muted">No orders yet.</T>
        )}
      </View>
    </Screen>
  );
}

function Stat({ icon, color, label, value, sub }: { icon: IconName; color: string; label: string; value: string; sub: string }) {
  return (
    <Card style={{ flex: 1, padding: Spacing.md, gap: 4 }}>
      <View style={[styles.statIcon, { backgroundColor: color + '1A' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <T variant="small">{label}</T>
      <T variant="h2" numberOfLines={1}>{value}</T>
      <T variant="small">{sub}</T>
    </Card>
  );
}

function NavTile({ href, icon, label, count, countTone = 'warning' }: { href: Href; icon: IconName; label: string; count?: number; countTone?: 'warning' | 'danger' }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.tile}>
        <View style={styles.tileIcon}>
          <Ionicons name={icon} size={20} color={Colors.primary} />
        </View>
        <T variant="h3" style={{ flex: 1, fontSize: 15 }}>{label}</T>
        {count ? <Badge label={String(count)} tone={countTone} /> : null}
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  link: { color: Colors.primaryDark, fontWeight: '700', fontSize: 14 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
