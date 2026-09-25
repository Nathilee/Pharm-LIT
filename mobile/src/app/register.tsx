import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Field, Notice, Screen, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { goNext } from '@/lib/navigation';

export default function RegisterScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await register({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, password });
      goNext(next);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={{ maxWidth: 460 }}>
      <View style={{ marginVertical: Spacing.lg }}>
        <T variant="h1">Create your account</T>
        <T variant="muted">Order medicines and get them delivered fast.</T>
      </View>
      <Card>
        {error ? <View style={{ marginBottom: Spacing.md }}><Notice tone="danger" icon="alert-circle">{error}</Notice></View> : null}
        <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" placeholder="Ama Mensah" />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
        <Field label="Phone (for delivery & MoMo)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="024 123 4567" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry hint="At least 6 characters" onSubmitEditing={submit} />
        <Button title="Create account" loading={busy} onPress={submit} />
      </Card>
      <View style={{ alignItems: 'center', marginTop: Spacing.lg }}>
        <T variant="muted">
          Already have an account?{' '}
          <Link href={{ pathname: '/login', params: next ? { next } : {} }} replace style={{ color: Colors.primaryDark, fontWeight: '700' }}>
            Sign in
          </Link>
        </T>
      </View>
    </Screen>
  );
}
