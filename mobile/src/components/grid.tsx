import { Children, ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';

/** Simple responsive grid: 2 columns on phones, more on tablets / desktop web. */
export function Grid({ children, minItemWidth = 160, gap = Spacing.md }: { children: ReactNode; minItemWidth?: number; gap?: number }) {
  const { width } = useWindowDimensions();
  const available = Math.min(width, MaxContentWidth) - Spacing.lg * 2;
  const columns = Math.max(2, Math.floor((available + gap) / (minItemWidth + gap)));
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={{ gap }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {row}
          {Array.from({ length: columns - row.length }).map((_, i) => (
            <View key={`pad-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}
