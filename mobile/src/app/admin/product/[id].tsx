import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, ErrorView, Field, Ionicons, Loading, Notice, Row, Screen, SectionTitle, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { confirmAsync, notify } from '@/lib/dialogs';
import type { Category, Product } from '@/lib/types';

type Form = {
  name: string;
  genericName: string;
  description: string;
  manufacturer: string;
  dosageForm: string;
  strength: string;
  packSize: string;
  imageUrl: string;
  price: string; // GH₵ as typed
  stock: string;
  categoryId: number | null;
  requiresPrescription: boolean;
  featured: boolean;
  active: boolean;
};

const empty: Form = {
  name: '', genericName: '', description: '', manufacturer: '', dosageForm: '', strength: '', packSize: '', imageUrl: '',
  price: '', stock: '0', categoryId: null, requiresPrescription: false, featured: false, active: true,
};

export default function AdminProductEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { isAdmin } = useAuth();
  const [form, setForm] = useState<Form>(empty);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [{ categories: cats }, prod] = await Promise.all([
          api<{ categories: Category[] }>('GET', '/api/categories'),
          isNew ? Promise.resolve(null) : api<{ products: Product[] }>('GET', `/api/admin/products`),
        ]);
        setCategories(cats);
        if (prod) {
          const p = prod.products.find((x) => String(x.id) === id);
          if (!p) throw new Error('Product not found');
          setForm({
            name: p.name, genericName: p.genericName ?? '', description: p.description ?? '',
            manufacturer: p.manufacturer ?? '', dosageForm: p.dosageForm ?? '', strength: p.strength ?? '',
            packSize: p.packSize ?? '', imageUrl: p.imageUrl ?? '', price: (p.price / 100).toFixed(2),
            stock: String(p.stock), categoryId: p.categoryId, requiresPrescription: p.requiresPrescription,
            featured: p.featured, active: p.active,
          });
        } else {
          setForm((f) => ({ ...f, categoryId: cats[0]?.id ?? null }));
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} />;

  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const price = Math.round(parseFloat(form.price.replace(/,/g, '')) * 100);
    const stock = parseInt(form.stock, 10);
    if (!form.name.trim()) return notify('Name is required');
    if (!Number.isFinite(price) || price < 0) return notify('Enter a valid price in GH₵');
    if (!Number.isInteger(stock) || stock < 0) return notify('Enter a valid stock quantity');
    const body = isAdmin
      ? {
          name: form.name, genericName: form.genericName, description: form.description, manufacturer: form.manufacturer,
          dosageForm: form.dosageForm, strength: form.strength, packSize: form.packSize, imageUrl: form.imageUrl,
          price, stock, categoryId: form.categoryId, requiresPrescription: form.requiresPrescription,
          featured: form.featured, active: form.active,
        }
      : { stock };
    setSaving(true);
    try {
      if (isNew) await api('POST', '/api/admin/products', body);
      else await api('PATCH', `/api/admin/products/${id}`, body);
      router.back();
    } catch (e: any) {
      notify('Could not save product', e.message);
    } finally {
      setSaving(false);
    }
  };

  const hide = async () => {
    if (!(await confirmAsync('Remove this product?', 'It will be hidden from the store. Past orders are kept.', 'Remove', true))) return;
    try {
      await api('DELETE', `/api/admin/products/${id}`);
      router.back();
    } catch (e: any) {
      notify('Could not remove product', e.message);
    }
  };

  const readOnly = !isAdmin;

  return (
    <Screen footer={<Button title={isNew ? 'Create product' : 'Save changes'} icon="save" loading={saving} onPress={save} />}>
      <Stack.Screen options={{ title: isNew ? 'New product' : form.name || 'Product' }} />
      {readOnly ? (
        <View style={{ marginBottom: Spacing.md }}>
          <Notice tone="info">Pharmacists can update stock levels. Ask an admin to change product details.</Notice>
        </View>
      ) : null}

      <Card>
        <Field label="Product name *" value={form.name} onChangeText={set('name')} editable={!readOnly} placeholder="e.g. Paracetamol 500mg Tablets" />
        <Field label="Generic name" value={form.genericName} onChangeText={set('genericName')} editable={!readOnly} />
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field label="Price (GH₵) *" value={form.price} onChangeText={set('price')} keyboardType="decimal-pad" editable={!readOnly} placeholder="15.00" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Stock *" value={form.stock} onChangeText={set('stock')} keyboardType="number-pad" />
          </View>
        </Row>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field label="Strength" value={form.strength} onChangeText={set('strength')} editable={!readOnly} placeholder="500mg" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Form" value={form.dosageForm} onChangeText={set('dosageForm')} editable={!readOnly} placeholder="Tablet" />
          </View>
        </Row>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field label="Pack size" value={form.packSize} onChangeText={set('packSize')} editable={!readOnly} placeholder="20 tablets" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Manufacturer" value={form.manufacturer} onChangeText={set('manufacturer')} editable={!readOnly} />
          </View>
        </Row>
        <Field label="Description" value={form.description} onChangeText={set('description')} multiline editable={!readOnly} />
        <Field label="Image URL (optional)" value={form.imageUrl} onChangeText={set('imageUrl')} autoCapitalize="none" editable={!readOnly} placeholder="https://…" />
      </Card>

      {!readOnly ? (
        <>
          <SectionTitle title="Category" />
          <Row style={{ flexWrap: 'wrap' }}>
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} selected={form.categoryId === c.id} onPress={() => set('categoryId')(c.id)} />
            ))}
          </Row>

          <SectionTitle title="Settings" />
          <Card style={{ gap: Spacing.sm }}>
            <Toggle label="Requires prescription (Rx)" hint="Customers must upload a prescription" value={form.requiresPrescription} onChange={set('requiresPrescription')} />
            <Toggle label="Featured on home screen" value={form.featured} onChange={set('featured')} />
            <Toggle label="Visible in store" value={form.active} onChange={set('active')} />
          </Card>

          {!isNew ? (
            <Button title="Remove product" variant="danger" icon="trash" style={{ marginTop: Spacing.lg }} onPress={hide} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggle} accessibilityRole="checkbox" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1 }}>
        <T variant="body">{label}</T>
        {hint ? <T variant="small">{hint}</T> : null}
      </View>
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={24} color={value ? Colors.primary : Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 6 },
});
