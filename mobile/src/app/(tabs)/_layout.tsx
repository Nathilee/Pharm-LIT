import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Colors } from '@/constants/theme';
import { useCart } from '@/context/cart';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type TabIconProps = { color: ColorValue; focused: boolean; size: number };

function TabIcon({ name, color, focused, size }: TabIconProps & { name: IconName }) {
  return <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={size} color={color} />;
}

const icon = (name: IconName) => {
  const render = (props: TabIconProps) => <TabIcon name={name} {...props} />;
  return render;
};

export default function TabLayout() {
  const { count } = useCart();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        tabBarStyle: { borderTopColor: Colors.border },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false, tabBarIcon: icon('home') }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop', tabBarIcon: icon('grid') }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: icon('cart'),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.accent },
        }}
      />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: icon('receipt') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
