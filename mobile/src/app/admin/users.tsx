import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { Card, Chip, ErrorView, Loading, Row, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { notify } from '@/lib/dialogs';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import type { Role, User } from '@/lib/types';

type AdminUser = User & { orderCount: number };

const ROLES: { id: Role; label: string }[] = [
  { id: 'customer', label: 'Customer' },
  { id: 'pharmacist', label: 'Pharmacist' },
  { id: 'admin', label: 'Admin' },
];

export default function AdminUsers() {
  const { user: me, isAdmin } = useAuth();
  const { data, setData, error, loading, reload, refreshing } = useApi<{ users: AdminUser[] }>(isAdmin ? '/api/admin/users' : null);

  if (!isAdmin) return <Redirect href="/admin" />;
  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={reload} />;

  const setRole = async (u: AdminUser, role: Role) => {
    if (u.role === role) return;
    try {
      const r = await api<{ user: User }>('PATCH', `/api/admin/users/${u.id}/role`, { role });
      setData((d) => d && { users: d.users.map((x) => (x.id === u.id ? { ...x, ...r.user } : x)) });
    } catch (e: any) {
      notify('Could not change role', e.message);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <T variant="muted" style={{ marginBottom: Spacing.md }}>
        Pharmacists can review prescriptions, manage orders and update stock. Admins can also edit products and manage staff.
      </T>
      <View style={{ gap: Spacing.sm }}>
        {data?.users.map((u) => (
          <Card key={u.id} style={{ gap: Spacing.sm }}>
            <View>
              <T variant="h3">{u.name}{u.id === me?.id ? ' (you)' : ''}</T>
              <T variant="small">{u.email}{u.phone ? ` · ${u.phone}` : ''}</T>
              <T variant="small">Joined {formatDate(u.createdAt, false)} · {u.orderCount} order{u.orderCount === 1 ? '' : 's'}</T>
            </View>
            {u.id !== me?.id ? (
              <Row style={{ flexWrap: 'wrap' }}>
                {ROLES.map((r) => (
                  <Chip key={r.id} label={r.label} selected={u.role === r.id} onPress={() => setRole(u, r.id)} />
                ))}
              </Row>
            ) : null}
          </Card>
        ))}
      </View>
    </Screen>
  );
}
