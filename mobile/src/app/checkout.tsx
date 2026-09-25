import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrescriptionItem, PrescriptionUploader } from '@/components/prescription-picker';
import { Button, Card, Divider, Field, IconName, Ionicons, KeyValue, Loading, Notice, Screen, SectionTitle, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useCart } from '@/context/cart';
import { api } from '@/lib/api';
import { notify } from '@/lib/dialogs';
import { money } from '@/lib/format';
import { payForOrder } from '@/lib/payments';
import { useApi } from '@/lib/use-api';
import type { Order, PaymentMethod, Prescription, Quote, StoreSettings } from '@/lib/types';

export default function CheckoutScreen() {
  const { user, loading: authLoading } = useAuth();
  const cart = useCart();
  const settings = useApi<StoreSettings>('/api/orders/settings').data;
  const rxList = useApi<{ prescriptions: Prescription[] }>(user && cart.requiresPrescription ? '/api/prescriptions' : null);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('paystack');
  const [pickedRxId, setRxId] = useState<number | null>(null);
  const [uploaderOpen, setShowUploader] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [placing, setPlacing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const cartKey = cart.lines.map((l) => `${l.product.id}x${l.quantity}`).join(',');
  useEffect(() => {
    if (!cart.lines.length) return;
    api<Quote>('POST', '/api/orders/quote', {
      items: cart.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
    })
      .then(setQuote)
      .catch(() => setQuote(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

  // Default to the newest usable prescription; show the uploader if there are none.
  const usable = rxList.data?.prescriptions.filter((p) => p.status !== 'rejected') ?? [];
  const rxId = pickedRxId ?? usable[0]?.id ?? null;
  const showUploader = uploaderOpen || (!!rxList.data && usable.length === 0);

  if (authLoading) return <Loading />;
  if (!user) return <Redirect href={{ pathname: '/login', params: { next: '/checkout' } }} />;
  if (submitted) return <Loading label="Taking you to payment…" />;
  if (!cart.lines.length) return <Redirect href="/cart" />;

  const selectedRx = usable.find((p) => p.id === rxId);

  const placeOrder = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter the recipient’s name';
    if (!/^\+?[0-9 ]{9,15}$/.test(phone.trim())) e.phone = 'Enter a valid phone number, e.g. 024 123 4567';
    if (address.trim().length < 5) e.address = 'Enter a delivery address or landmark';
    if (cart.requiresPrescription && !rxId) e.rx = 'Upload or select a prescription';
    setErrors(e);
    if (Object.keys(e).length) return;

    setPlacing(true);
    try {
      const { order } = await api<{ order: Order }>('POST', '/api/orders', {
        items: cart.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        paymentMethod: method,
        prescriptionId: cart.requiresPrescription ? rxId : undefined,
        delivery: { name: name.trim(), phone: phone.trim(), address: address.trim() },
        notes: notes.trim() || undefined,
      });
      setSubmitted(true);
      cart.clear();

      if (order.status === 'pending_payment') {
        try {
          const result = await payForOrder(order.id);
          if (result === null) return; // web: browser is navigating to checkout
        } catch (err: any) {
          notify('Payment could not start', err.message);
        }
      }
      router.replace({ pathname: '/order/[id]', params: { id: String(order.id), placed: '1' } });
    } catch (err: any) {
      notify('Could not place order', err.message);
    } finally {
      setPlacing(false);
    }
  };

  const total = quote?.total ?? cart.subtotal;
  const willWaitForRx = cart.requiresPrescription && selectedRx?.status === 'pending';
  const cta = willWaitForRx
    ? 'Submit order for review'
    : method === 'paystack'
      ? `Pay ${money(total)}`
      : `Place order · ${money(total)}`;

  return (
    <Screen footer={<Button title={cta} icon={method === 'paystack' && !willWaitForRx ? 'lock-closed' : 'checkmark-circle'} loading={placing} onPress={placeOrder} />}>
      {quote?.problems.length ? (
        <Notice tone="danger" icon="alert-circle" title="Please update your cart">
          {quote.problems.map((p) => p.message).join('\n')}
        </Notice>
      ) : null}

      <SectionTitle title="Delivery details" />
      <Card>
        <Field label="Full name" value={name} onChangeText={setName} error={errors.name} autoComplete="name" />
        <Field
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          error={errors.phone}
          keyboardType="phone-pad"
          placeholder="024 123 4567"
          autoComplete="tel"
        />
        <Field
          label="Delivery address"
          value={address}
          onChangeText={setAddress}
          error={errors.address}
          placeholder="House no., street, area and a landmark (or GhanaPost GPS)"
          multiline
        />
        <Field label="Delivery note (optional)" value={notes} onChangeText={setNotes} placeholder="e.g. Call when you arrive" />
      </Card>

      {cart.requiresPrescription ? (
        <>
          <SectionTitle title="Prescription" />
          <Card style={{ gap: Spacing.sm }}>
            <T variant="small">
              Your cart has prescription-only medicines:{' '}
              {cart.lines.filter((l) => l.product.requiresPrescription).map((l) => l.product.name).join(', ')}.
            </T>
            {rxList.loading ? <Loading /> : null}
            {usable.map((p) => (
              <PrescriptionItem key={p.id} p={p} selected={rxId === p.id} onPress={() => setRxId(p.id)} />
            ))}
            {showUploader ? (
              <PrescriptionUploader
                onUploaded={(p) => {
                  rxList.setData((d) => ({ prescriptions: [p, ...(d?.prescriptions ?? [])] }));
                  setRxId(p.id);
                  setShowUploader(false);
                }}
              />
            ) : (
              <Button title="Upload a new prescription" variant="secondary" icon="add" size="sm" onPress={() => setShowUploader(true)} />
            )}
            {errors.rx ? <T variant="small" style={{ color: Colors.danger }}>{errors.rx}</T> : null}
            {willWaitForRx ? (
              <Notice tone="warning" icon="time">
                A pharmacist will review your prescription (usually within 30 minutes during opening hours). You’ll be able to pay as soon as it’s approved.
              </Notice>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionTitle title="Payment method" />
      <View style={{ gap: Spacing.sm }}>
        <PayOption
          icon="phone-portrait"
          title="Mobile Money or Card"
          subtitle="MTN MoMo, Telecel Cash, AirtelTigo Money, Visa & Mastercard — secured by Paystack"
          selected={method === 'paystack'}
          onPress={() => setMethod('paystack')}
        />
        <PayOption
          icon="cash"
          title="Pay on delivery"
          subtitle="Pay with cash or MoMo when your order arrives"
          selected={method === 'cash_on_delivery'}
          onPress={() => setMethod('cash_on_delivery')}
        />
      </View>
      {settings?.demoPayments && method === 'paystack' ? (
        <View style={{ marginTop: Spacing.sm }}>
          <Notice tone="neutral" icon="flask">
            Demo mode: payments are simulated until a Paystack secret key is added on the server.
          </Notice>
        </View>
      ) : null}

      <SectionTitle title="Order summary" />
      <Card>
        {(quote?.lines ?? []).map((l) => (
          <KeyValue key={l.productId} label={`${l.quantity} × ${l.name}`} value={money(l.lineTotal)} />
        ))}
        <Divider />
        <KeyValue label="Subtotal" value={money(quote?.subtotal ?? cart.subtotal)} />
        <KeyValue label="Delivery" value={quote ? (quote.deliveryFee === 0 ? 'FREE' : money(quote.deliveryFee)) : '—'} />
        <Divider />
        <KeyValue label="Total" value={money(total)} bold />
      </Card>
    </Screen>
  );
}

function PayOption({
  icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.pay, selected && styles.paySelected]} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
      <View style={[styles.payIcon, selected && { backgroundColor: Colors.primary }]}>
        <Ionicons name={icon} size={22} color={selected ? Colors.white : Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="h3" style={{ fontSize: 15 }}>{title}</T>
        <T variant="small">{subtitle}</T>
      </View>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? Colors.primary : Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.white,
  },
  paySelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  payIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
