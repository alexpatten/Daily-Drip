import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, shadow } from '@/theme';

// Web windows at least this wide get the menu across the top; phones and narrow windows
// get icons along the bottom.
const WIDE_MIN_WIDTH = 768;

export function useWideNav(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_MIN_WIDTH;
}

type IconName = ComponentProps<typeof Ionicons>['name'];

type NavItem = {
  route: string; // the tab's route name
  href: Href;
  label: string; // on the wide menu
  shortLabel: string; // under the icon
  icon: IconName;
  activeIcon: IconName;
  // Signed out, these go to sign-in instead.
  needsAccount?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { route: 'index', href: '/', label: 'Today', shortLabel: 'Today', icon: 'cafe-outline', activeIcon: 'cafe' },
  {
    route: 'history',
    href: '/history',
    label: 'Past brews',
    shortLabel: 'Past brews',
    icon: 'time-outline',
    activeIcon: 'time',
    needsAccount: true,
  },
  {
    route: 'study',
    href: '/study',
    label: 'Study session',
    shortLabel: 'Study',
    icon: 'book-outline',
    activeIcon: 'book',
    needsAccount: true,
  },
  { route: 'awards', href: '/awards', label: 'Awards', shortLabel: 'Awards', icon: 'trophy-outline', activeIcon: 'trophy' },
  { route: 'settings', href: '/settings', label: 'Settings', shortLabel: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
];

/** The app's menu: across the top on wide web windows, icons along the bottom elsewhere. */
export function NavBar({ state, insets }: BottomTabBarProps) {
  const wide = useWideNav();
  const signedIn = !!useAuth().session;
  const focused = state.routes[state.index]?.name;
  const hrefFor = (item: NavItem): Href => (item.needsAccount && !signedIn ? '/sign-in' : item.href);

  if (wide) {
    return (
      <View style={[styles.top, { paddingTop: insets.top }]} accessibilityRole="menubar">
        <View style={styles.topInner}>
          <Link href="/" asChild>
            <Pressable accessibilityRole="link">
              {({ pressed }) => <Text style={[styles.brand, pressed && styles.pressed]}>Daily Drip</Text>}
            </Pressable>
          </Link>
          <View style={styles.topLinks}>
            {NAV_ITEMS
              .filter((item) => item.route !== 'index')
              .map((item) => {
                const active = item.route === focused;
                return (
                  <Link key={item.route} href={hrefFor(item)} asChild>
                    <Pressable accessibilityRole="link" accessibilityState={{ selected: active }}>
                      {({ pressed, hovered }) => (
                        <View
                          style={[
                            styles.topLink,
                            (active || hovered) && styles.topLinkActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={[styles.topLinkText, active && styles.activeText]}>{item.label}</Text>
                        </View>
                      )}
                    </Pressable>
                  </Link>
                );
              })}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.bottom, { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}
      accessibilityRole="tablist"
    >
      {NAV_ITEMS.map((item) => {
        const active = item.route === focused;
        return (
          <Link key={item.route} href={hrefFor(item)} asChild>
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              style={styles.tab}
            >
              {({ pressed }) => (
                <View style={[styles.tabInner, pressed && styles.pressed]}>
                  <View style={[styles.iconPill, active && styles.iconPillActive]}>
                    <Ionicons
                      name={active ? item.activeIcon : item.icon}
                      size={22}
                      color={active ? colors.espresso : colors.mocha}
                    />
                  </View>
                  <Text style={[styles.tabLabel, active && styles.activeText]} numberOfLines={1}>
                    {item.shortLabel}
                  </Text>
                </View>
              )}
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.blushDeep,
    ...shadow,
  },
  topInner: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  brand: { fontFamily: fonts.display, fontSize: 24, color: colors.espresso },
  topLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 },
  topLink: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  topLinkActive: { backgroundColor: colors.roseSoft },
  topLinkText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.mocha },
  activeText: { color: colors.espresso },
  bottom: {
    flexDirection: 'row',
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.blushDeep,
    ...shadow,
  },
  tab: { flex: 1, minHeight: 60 },
  tabInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6 },
  iconPill: { paddingVertical: 4, paddingHorizontal: 16, borderRadius: radius.pill },
  iconPillActive: { backgroundColor: colors.roseSoft },
  tabLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.mocha },
  pressed: { opacity: 0.75 },
});
