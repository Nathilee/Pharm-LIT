import { Redirect, router, Stack } from 'expo-router';

import { Button, Loading } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function AdminLayout() {
  const { user, loading, isStaff } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href={{ pathname: '/login', params: { next: '/admin' } }} />;
  if (!isStaff) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Pharmacy dashboard',
          headerRight: () => (
            <Button title="Store" icon="storefront-outline" size="sm" variant="ghost" onPress={() => router.replace('/account')} />
          ),
        }}
      />
      <Stack.Screen name="orders" options={{ title: 'Orders' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
      <Stack.Screen name="prescriptions" options={{ title: 'Prescriptions' }} />
      <Stack.Screen name="products" options={{ title: 'Products & stock' }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Product' }} />
      <Stack.Screen name="users" options={{ title: 'Users & roles' }} />
    </Stack>
  );
}
