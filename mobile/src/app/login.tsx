import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Field, Ionicons, Notice, Screen, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { goNext } from '@/lib/navigation';

export default function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      goNext(next);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={{ maxWidth: 460 }}>
      <View style={{ alignItems: 'center', marginVertical: Spacing.xl }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="medkit" size={32} color={Colors.primary} />
        </View>
        <T variant="h1" style={{ marginTop: Spacing.md }}>Welcome back</T>
        <T variant="muted">Sign in to your Pharm-LIT account</T>
      </View>
      <Card>
        {error ? <View style={{ marginBottom: Spacing.md }}><Notice tone="danger" icon="alert-circle">{error}</Notice></View> : null}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} placeholder="••••••••" />
        <Button title="Sign in" loading={busy} onPress={submit} />
      </Card>
      <View style={{ alignItems: 'center', marginTop: Spacing.lg }}>
        <T variant="muted">
          New to Pharm-LIT?{' '}
          <Link href={{ pathname: '/register', params: next ? { next } : {} }} replace style={{ color: Colors.primaryDark, fontWeight: '700' }}>
            Create an account
          </Link>
        </T>
      </View>
      <View style={{ marginTop: Spacing.xl }}>
        <Notice tone="neutral" icon="key" title="Demo accounts">
          {'Customer: ama@example.com / password123\nAdmin: admin@pharmlit.com / admin123'}
        </Notice>
      </View>
    </Screen>
  );
}
