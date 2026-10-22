import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, MAX_CONTENT_WIDTH } from '@/theme';

type Props = {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

// Scrollable, safe-area-aware column that stays phone-width on big screens.
export function Screen({ children, refreshing = false, onRefresh }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingLeft: insets.left + 16,
        paddingRight: insets.right + 16,
      }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mocha} />
        ) : undefined
      }
    >
      <View style={styles.column}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.blush },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: 18 },
});
