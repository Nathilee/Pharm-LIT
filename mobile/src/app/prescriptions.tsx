import { router } from 'expo-router';
import { View } from 'react-native';

import { PrescriptionItem, PrescriptionUploader } from '@/components/prescription-picker';
import { Button, EmptyState, ErrorView, Loading, Notice, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { notify } from '@/lib/dialogs';
import { useApi } from '@/lib/use-api';
import type { Prescription } from '@/lib/types';

export default function PrescriptionsScreen() {
  const { user, loading: authLoading } = useAuth();
  const { data, setData, error, loading, reload, refreshing } = useApi<{ prescriptions: Prescription[] }>(
    user ? '/api/prescriptions' : null,
  );

  if (authLoading) return <Loading />;
  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="document-text-outline"
          title="Upload a prescription"
          message="Sign in to upload prescriptions and order prescription-only medicines."
          action={<Button title="Sign in" icon="log-in" onPress={() => router.push({ pathname: '/login', params: { next: '/prescriptions' } })} />}
        />
      </Screen>
    );
  }
  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={reload} />;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Notice tone="info" icon="shield-checkmark" title="How it works">
        Upload a clear photo of your prescription. A licensed pharmacist checks every prescription before prescription-only medicines are dispatched. Then add the medicines to your cart and select this prescription at checkout.
      </Notice>

      <SectionTitle title="New prescription" />
      <PrescriptionUploader
        onUploaded={(p) => {
          setData((d) => ({ prescriptions: [p, ...(d?.prescriptions ?? [])] }));
          notify('Prescription uploaded', 'A pharmacist will review it shortly.');
        }}
      />

      <SectionTitle title="My prescriptions" />
      {data?.prescriptions.length ? (
        <View style={{ gap: Spacing.sm }}>
          {data.prescriptions.map((p) => (
            <PrescriptionItem key={p.id} p={p} />
          ))}
        </View>
      ) : (
        <EmptyState icon="documents-outline" title="No prescriptions yet" />
      )}
    </Screen>
  );
}
