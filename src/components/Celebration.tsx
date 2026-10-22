import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';

const useNativeDriver = Platform.OS !== 'web';

async function motionAllowed() {
  try {
    return !(await AccessibilityInfo.isReduceMotionEnabled());
  } catch {
    return true;
  }
}

// Spins its children a full turn (with a little pop) each time `trigger` goes up.
export function Twirl({ trigger, children }: { trigger: number; children: ReactNode }) {
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!trigger) return;
    let cancelled = false;
    let anim: Animated.CompositeAnimation | undefined;
    motionAllowed().then((ok) => {
      if (!ok || cancelled) return;
      spin.setValue(0);
      anim = Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.back(1.7)),
        useNativeDriver,
      });
      anim.start();
    });
    return () => {
      cancelled = true;
      anim?.stop();
    };
  }, [trigger, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = spin.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [1, 1.14, 1],
    extrapolate: 'clamp',
  });
  return <Animated.View style={{ transform: [{ rotate }, { scale }] }}>{children}</Animated.View>;
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

// A one-shot shower of petals over the whole screen. Remount (new key) to replay.
export function PetalShower() {
  const { width, height } = useWindowDimensions();
  const [petals, setPetals] = useState<Petal[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    motionAllowed().then((ok) => {
      if (ok && !cancelled) setPetals(makePetals());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Start once the petals are mounted so the native driver has views to drive.
  useEffect(() => {
    if (!petals) return;
    const anim = Animated.parallel(
      petals.map((p) =>
        Animated.timing(p.progress, {
          toValue: 1,
          duration: p.duration,
          delay: p.delay,
          easing: Easing.linear,
          useNativeDriver,
        }),
      ),
    );
    anim.start(({ finished }) => finished && setPetals(null));
    return () => anim.stop();
  }, [petals]);

  if (!petals) return null;
  return (
    <View style={styles.overlay} aria-hidden>
      {petals.map((p, i) => (
        <FallingPetal key={i} petal={p} width={width} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' },
  petal: { position: 'absolute', top: 0 },
});
