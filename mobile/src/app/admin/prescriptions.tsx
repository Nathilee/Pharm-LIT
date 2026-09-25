import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, Chip, EmptyState, ErrorView, Field, Ionicons, Loading, Row, Screen, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { api, authedUrl } from '@/lib/api';
import { notify } from '@/lib/dialogs';
import { formatDate, money, ORDER_STATUS, RX_STATUS } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import type { Prescription, PrescriptionStatus } from '@/lib/types';

export default function AdminPrescriptions() {
  const [filter, setFilter] = useState<PrescriptionStatus>('pending');
  const { data, setData, error, loading, reload, refreshing } = useApi<{ prescriptions: Prescription[] }>(
    `/api/admin/prescriptions?status=${filter}`,
  );
  const [zoom, setZoom] = useState<string | null>(null);

  const onReviewed = (p: Prescription) =>
    setData((d) => (d ? { prescriptions: d.prescriptions.filter((x) => x.id !== p.id) } : d));

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Row style={{ marginBottom: Spacing.md }}>
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <Chip key={s} label={s === 'pending' ? 'To review' : RX_STATUS[s].label} selected={filter === s} onPress={() => setFilter(s)} />
        ))}
      </Row>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data?.prescriptions.length ? (
        <View style={{ gap: Spacing.md }}>
          {data.prescriptions.map((p) => (
            <RxCard key={p.id} p={p} onZoom={setZoom} onReviewed={onReviewed} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="checkmark-done-circle-outline"
          title={filter === 'pending' ? 'All caught up!' : 'Nothing here'}
          message={filter === 'pending' ? 'There are no prescriptions waiting for review.' : undefined}
        />
      )}

      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.modal} onPress={() => setZoom(null)}>
          {zoom ? <Image source={{ uri: zoom }} style={{ width: '100%', height: '85%' }} contentFit="contain" /> : null}
          <T style={{ color: Colors.white, marginTop: Spacing.md }}>Tap anywhere to close</T>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function RxCard({ p, onZoom, onReviewed }: { p: Prescription; onZoom: (uri: string) => void; onReviewed: (p: Prescription) => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const uri = authedUrl(p.imageUrl);

  const decide = async (status: 'approved' | 'rejected') => {
    setBusy(status);
    try {
      const r = await api<{ prescription: Prescription }>('PATCH', `/api/admin/prescriptions/${p.id}`, {
        status,
        note: note.trim() || undefined,
      });
      onReviewed(r.prescription);
    } catch (e: any) {
      notify('Could not save review', e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={{ gap: Spacing.md }}>
      <Row style={{ alignItems: 'flex-start' }} gap={Spacing.md}>
        <Pressable onPress={() => onZoom(uri)}>
          <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
          <View style={styles.zoomHint}>
            <Ionicons name="expand" size={14} color={Colors.white} />
          </View>
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h3">Prescription #{p.id}</T>
            <Badge label={RX_STATUS[p.status].label} tone={RX_STATUS[p.status].tone} />
          </Row>
          <T variant="body">{p.userName}</T>
          <T variant="small">{p.userEmail}</T>
          <T variant="small">Uploaded {formatDate(p.createdAt)}</T>
          {p.doctorName ? <T variant="small">Doctor: {p.doctorName}</T> : null}
          {p.notes ? <T variant="small">Note: “{p.notes}”</T> : null}
          {p.reviewNote ? <T variant="small">Review note: {p.reviewNote}</T> : null}
        </View>
      </Row>

      {p.orders?.length ? (
        <View style={{ gap: 4 }}>
          <T variant="label">Linked orders</T>
          <ScrollView horizontal contentContainerStyle={{ gap: Spacing.sm }}>
            {p.orders.map((o) => (
              <Link key={o.id} href={{ pathname: '/admin/order/[id]', params: { id: String(o.id) } }} asChild>
                <Pressable style={styles.orderPill}>
                  <T variant="small" style={{ color: Colors.text, fontWeight: '700' }}>#{o.id} · {money(o.total)}</T>
                  <T variant="small">{ORDER_STATUS[o.status].label}</T>
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {p.status === 'pending' ? (
        <>
          {rejecting ? (
            <Field
              label="Reason for rejecting (sent to customer)"
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Prescription is expired / unreadable / not signed"
              multiline
            />
          ) : null}
          <Row>
            {rejecting ? (
              <>
                <Button title="Back" variant="outline" onPress={() => setRejecting(false)} style={{ flex: 1 }} />
                <Button
                  title="Confirm reject"
                  variant="danger"
                  icon="close-circle"
                  loading={busy === 'rejected'}
                  disabled={!note.trim()}
                  onPress={() => decide('rejected')}
                  style={{ flex: 1 }}
                />
              </>
            ) : (
              <>
                <Button title="Reject" variant="danger" icon="close-circle" onPress={() => setRejecting(true)} style={{ flex: 1 }} />
                <Button title="Approve" icon="checkmark-circle" loading={busy === 'approved'} onPress={() => decide('approved')} style={{ flex: 1 }} />
              </>
            )}
          </Row>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 96, height: 120, borderRadius: Radius.md, backgroundColor: '#EEF1F4' },
  zoomHint: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    padding: 4,
  },
  orderPill: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
});
