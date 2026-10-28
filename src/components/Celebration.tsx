import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Award } from '@/lib/awards';
import { colors, fonts, radius, shadow } from '@/theme';
import { CoffeeBadge } from './CoffeeBadge';
import { LatteHearts } from './LatteHearts';

const useNativeDriver = Platform.OS !== 'web';

export async function motionAllowed() {
  try {
    return !(await AccessibilityInfo.isReduceMotionEnabled());
  } catch {
    return true;
  }
}

const SHAPES = {
  // Cherry-blossom petal with a notch at the tip.
  blossom: 'M0 12 C-9 7, -10 -5, -4 -11 L0 -7 L4 -11 C10 -5, 9 7, 0 12 Z',
  oval: 'M0 -12 C7 -7, 7 7, 0 12 C-7 7, -7 -7, 0 -12 Z',
};

const FILLS = [colors.rose, colors.roseSoft, colors.honey, colors.foam, colors.berrySoft, colors.blushDeep];
const COUNT = 26;

type Petal = {
  progress: Animated.Value;
  x: number; // 0..1 across the screen
  size: number;
  fill: string;
  shape: keyof typeof SHAPES;
  delay: number;
  duration: number;
  sway: number;
  swayCycles: number;
  turns: number;
  flutterCycles: number;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function makePetals(): Petal[] {
  return Array.from({ length: COUNT }, (_, i) => ({
    progress: new Animated.Value(0),
    x: rand(-0.03, 0.97),
    size: rand(16, 30),
    fill: FILLS[i % FILLS.length],
    shape: Math.random() < 0.6 ? 'blossom' : 'oval',
    delay: rand(0, 900),
    duration: rand(2800, 4400),
    sway: rand(18, 48),
    swayCycles: rand(1, 2.2),
    turns: rand(1, 2.5) * (Math.random() < 0.5 ? -1 : 1),
    flutterCycles: rand(1.5, 3.5),
  }));
}

// interpolate() is piecewise linear, so sample the waves finely enough to look smooth.
const STEPS = 16;
const INPUT = Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS);
const wave = (cycles: number, amp: number, phase = 0) =>
  INPUT.map((t) => amp * Math.sin(2 * Math.PI * cycles * t + phase));

function FallingPetal({ petal: p, width, height }: { petal: Petal; width: number; height: number }) {
  const t = p.progress;
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-p.size * 2, height + p.size] });
  const translateX = t.interpolate({ inputRange: INPUT, outputRange: wave(p.swayCycles, p.sway) });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.turns * 360}deg`] });
  // Squashing scaleX through zero reads as the petal tumbling edge-on.
  const scaleX = t.interpolate({ inputRange: INPUT, outputRange: wave(p.flutterCycles, 1, Math.PI / 2) });
  const opacity = t.interpolate({ inputRange: [0, 0.06, 0.85, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      style={[
        styles.petal,
        {
          left: p.x * width,
          width: p.size,
          height: p.size,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }, { scaleX }],
        },
      ]}
    >
      <Svg width={p.size} height={p.size} viewBox="-14 -14 28 28">
        <Path d={SHAPES[p.shape]} fill={p.fill} stroke={colors.espresso} strokeWidth={1.6} strokeLinejoin="round" />
        {p.shape === 'blossom' && (
          <Path d="M0 8 L0 -2" stroke={colors.espresso} strokeWidth={1.2} strokeLinecap="round" opacity={0.35} />
        )}
      </Svg>
    </Animated.View>
  );
}

type Cup = { pop: Animated.Value; spin: Animated.Value; out: Animated.Value };

// Pops in with a bounce, twirls a full turn, then floats up and fades.
function cupAnimation(c: Cup) {
  return Animated.sequence([
    Animated.parallel([
      Animated.spring(c.pop, { toValue: 1, friction: 5, tension: 110, useNativeDriver }),
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(c.spin, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.back(1.7)),
          useNativeDriver,
        }),
      ]),
    ]),
    Animated.delay(450),
    Animated.timing(c.out, { toValue: 1, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver }),
  ]);
}

// The streak's number rolls over from yesterday's count to today's.
function StreakCount({ cup: c, size, streak }: { cup: Cup; size: number; streak: number }) {
  const shift = size * 0.42;
  const outY = c.spin.interpolate({ inputRange: [0, 1], outputRange: [0, -shift] });
  const outOpacity = c.spin.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' });
  const inY = c.spin.interpolate({ inputRange: [0, 1], outputRange: [shift, 0] });
  const inOpacity = c.spin.interpolate({ inputRange: [0.3, 0.8], outputRange: [0, 1], extrapolate: 'clamp' });
  const numberStyle = [styles.streakNumber, { fontSize: size * 0.5, lineHeight: size * 0.6 }];
  return (
    <View style={[styles.streakCount, { width: size, height: size * 0.6 }]}>
      <Animated.Text style={[numberStyle, { opacity: outOpacity, transform: [{ translateY: outY }] }]}>
        {streak - 1}
      </Animated.Text>
      <Animated.Text style={[numberStyle, { opacity: inOpacity, transform: [{ translateY: inY }] }]}>
        {streak}
      </Animated.Text>
    </View>
  );
}

function SpinningCup({ cup: c, size, award, streak }: { cup: Cup; size: number; award?: Award; streak?: number }) {
  const fadeIn = c.pop.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' });
  const fadeOut = c.out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const popScale = c.pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const shrink = c.out.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] });
  const translateY = c.out.interpolate({ inputRange: [0, 1], outputRange: [0, -36] });
  const rotate = c.spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const halo = size * 1.25;

  return (
    <Animated.View
      style={[
        styles.cup,
        {
          opacity: Animated.multiply(fadeIn, fadeOut),
          transform: [{ translateY }, { scale: Animated.multiply(popScale, shrink) }],
        },
      ]}
    >
      <View style={[styles.halo, { width: halo, height: halo, borderRadius: halo / 2 }]}>
        {streak ? (
          <StreakCount cup={c} size={size} streak={streak} />
        ) : (
          <Animated.View style={{ transform: [{ rotate }] }}>
            {award ? <CoffeeBadge award={award.id} size={size} /> : <LatteHearts size={size} />}
          </Animated.View>
        )}
      </View>
      {award ? (
        <View style={styles.caption}>
          <Text style={styles.captionLabel}>Award unlocked</Text>
          <Text style={styles.captionName}>{award.name}</Text>
        </View>
      ) : streak ? (
        <View style={styles.caption}>
          <Text style={styles.captionLabel}>Streak</Text>
          <Text style={styles.captionName}>{streak} days in a row</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

type Shower = { petals: Petal[]; cup: Cup };

function makeShower(): Shower {
  return {
    petals: makePetals(),
    cup: { pop: new Animated.Value(0), spin: new Animated.Value(0), out: new Animated.Value(0) },
  };
}

type Props = {
  // An award to show off in place of the logo cup.
  award?: Award;
  // A streak that just grew, shown as its day count in place of the logo cup.
  streak?: number;
  onDone?: () => void;
};

// A one-shot celebration over the whole screen, so it's seen wherever the
// person has scrolled to. Remount (new key) to replay.
export function Celebration({ award, streak, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const [shower, setShower] = useState<Shower | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    let cancelled = false;
    if (award) AccessibilityInfo.announceForAccessibility(`Award unlocked: ${award.name}`);
    else if (streak) AccessibilityInfo.announceForAccessibility(`${streak} day streak`);
    motionAllowed().then((ok) => {
      if (cancelled) return;
      if (ok) setShower(makeShower());
      // Without motion there's nothing to wait for.
      else setTimeout(() => done.current?.(), award || streak ? 1500 : 0);
    });
    return () => {
      cancelled = true;
    };
  }, [award, streak]);

  // Start once everything is mounted so the native driver has views to drive.
  useEffect(() => {
    if (!shower) return;
    const anim = Animated.parallel([
      cupAnimation(shower.cup),
      ...shower.petals.map((p) =>
        Animated.timing(p.progress, {
          toValue: 1,
          duration: p.duration,
          delay: p.delay,
          easing: Easing.linear,
          useNativeDriver,
        }),
      ),
    ]);
    anim.start(({ finished }) => {
      if (!finished) return;
      setShower(null);
      done.current?.();
    });
    return () => anim.stop();
  }, [shower]);

  if (!shower) return null;
  return (
    <View style={styles.overlay} aria-hidden>
      <SpinningCup cup={shower.cup} size={Math.min(width * 0.42, 170)} award={award} streak={streak} />
      {shower.petals.map((p, i) => (
        <FallingPetal key={i} petal={p} width={width} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  cup: { alignItems: 'center', gap: 14 },
  halo: { backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', ...shadow },
  caption: {
    backgroundColor: colors.cream,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: 'center',
    ...shadow,
  },
  captionLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.caramel, textTransform: 'uppercase', letterSpacing: 1 },
  captionName: { fontFamily: fonts.display, fontSize: 20, color: colors.espresso },
  petal: { position: 'absolute', top: 0 },
  streakCount: { overflow: 'hidden' },
  streakNumber: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontFamily: fonts.display,
    color: colors.caramel,
    textAlign: 'center',
  },
});

type Cheer = { id: number; award?: Award; streak?: number };

/**
 * Celebrations for a screen: a plain one for a right answer, one for a streak that just
 * grew, and one per award earned. The streak and awards play one after another; a plain
 * cheer just replays the current one.
 */
export function useCelebrations() {
  const [queue, setQueue] = useState<Cheer[]>([]);
  const nextId = useRef(0);

  const celebrate = useCallback((earned: Award[] = [], streak?: number) => {
    const added: Cheer[] = [
      ...(streak ? [{ id: ++nextId.current, streak }] : []),
      ...earned.map((award) => ({ id: ++nextId.current, award })),
    ];
    const plain = { id: ++nextId.current };
    setQueue((q) => {
      const special = [...q.filter((c) => c.award || c.streak), ...added];
      return special.length > 0 ? special : [plain];
    });
  }, []);

  const current = queue[0];
  const finish = useCallback(() => setQueue((q) => q.slice(1)), []);
  const celebration = current ? (
    <Celebration key={current.id} award={current.award} streak={current.streak} onDone={finish} />
  ) : null;
  return { celebration, celebrate };
}
