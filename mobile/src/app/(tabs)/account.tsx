import { Href, Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, EmptyState, Field, IconName, Ionicons, Row, Screen, SectionTitle, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { confirmAsync, notify } from '@/lib/dialogs';

export default function AccountScreen() {
  const { user, isStaff, logout, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="person-circle-outline"
          title="Welcome to Pharm-LIT"
          message="Sign in or create an account to order medicines, upload prescriptions and track deliveries."
          action={
            <View style={{ gap: Spacing.sm, width: 260 }}>
              <Button title="Sign in" icon="log-in" onPress={() => router.push('/login')} />
              <Button title="Create account" variant="outline" onPress={() => router.push('/register')} />
            </View>
          }
        />
      </Screen>
    );
  }

  const startEdit = () => {
    setName(user.name);
    setPhone(user.phone ?? '');
    setAddress(user.address ?? '');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, phone, address });
      setEditing(false);
    } catch (e: any) {
      notify('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Row gap={Spacing.md}>
          <View style={styles.avatar}>
            <T variant="h2" style={{ color: Colors.white }}>{user.name.charAt(0).toUpperCase()}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="h2">{user.name}</T>
            <T variant="muted">{user.email}</T>
            {user.role !== 'customer' ? <Badge label={user.role === 'admin' ? 'Administrator' : 'Pharmacist'} tone="info" icon="shield-checkmark" /> : null}
          </View>
        </Row>
      </Card>

      {isStaff ? (
        <>
          <SectionTitle title="Pharmacy management" />
          <MenuItem icon="speedometer" label="Admin dashboard" hint="Orders, prescriptions, stock" href="/admin" highlight />
        </>
      ) : null}

      <SectionTitle title="My account" />
      <View style={{ gap: Spacing.sm }}>
        <MenuItem icon="receipt" label="My orders" href="/orders" />
        <MenuItem icon="document-text" label="My prescriptions" href="/prescriptions" />
      </View>

      <SectionTitle
        title="Delivery details"
        action={!editing ? <Button title="Edit" size="sm" variant="ghost" icon="create-outline" onPress={startEdit} /> : undefined}
      />
      <Card>
        {editing ? (
          <>
            <Field label="Full name" value={name} onChangeText={setName} />
            <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Field label="Default delivery address" value={address} onChangeText={setAddress} multiline />
            <Row>
              <Button title="Cancel" variant="outline" onPress={() => setEditing(false)} style={{ flex: 1 }} />
              <Button title="Save" loading={saving} onPress={save} style={{ flex: 1 }} />
            </Row>
          </>
        ) : (
          <View style={{ gap: 6 }}>
            <Row><Ionicons name="call-outline" size={18} color={Colors.textMuted} /><T>{user.phone || 'No phone number yet'}</T></Row>
            <Row style={{ alignItems: 'flex-start' }}>
              <Ionicons name="location-outline" size={18} color={Colors.textMuted} />
              <T style={{ flex: 1 }}>{user.address || 'No delivery address yet'}</T>
            </Row>
          </View>
        )}
      </Card>

      <SectionTitle title="Help" />
      <Card style={{ gap: 6 }}>
        <Row><Ionicons name="time-outline" size={18} color={Colors.textMuted} /><T>Open daily, 7:00am – 10:00pm</T></Row>
        <Row><Ionicons name="call-outline" size={18} color={Colors.textMuted} /><T>Talk to a pharmacist: 030 000 0000</T></Row>
        <T variant="small" style={{ marginTop: 4 }}>
          In an emergency, call 112 or go to the nearest hospital. Pharm-LIT does not replace medical advice.
        </T>
      </Card>

      <Button
        title="Sign out"
        variant="danger"
        icon="log-out"
        style={{ marginTop: Spacing.xl }}
        onPress={async () => {
          if (await confirmAsync('Sign out?', undefined, 'Sign out')) logout();
        }}
      />
    </Screen>
  );
}

function MenuItem({ icon, label, hint, href, highlight }: { icon: IconName; label: string; hint?: string; href: Href; highlight?: boolean }) {
  return (
    <Link href={href} asChild>
      <Pressable style={StyleSheet.flatten([styles.menu, highlight && { borderColor: Colors.primary, backgroundColor: Colors.primarySoft }])}>
        <View style={[styles.menuIcon, highlight && { backgroundColor: Colors.primary }]}>
          <Ionicons name={icon} size={20} color={highlight ? Colors.white : Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="h3" style={{ fontSize: 15 }}>{label}</T>
          {hint ? <T variant="small">{hint}</T> : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  menu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  menuIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
