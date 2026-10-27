import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

// Award art: kawaii coffees drawn like the LatteHearts logo, each in its own colors.

type Kind = 'latte' | 'mug' | 'togo' | 'iced' | 'espresso';
type Face = 'smile' | 'grin' | 'wink' | 'joy' | 'sleepy';
type Topping = 'heart' | 'star' | 'leaf' | 'none';
type Accent = 'hearts' | 'stars' | 'sparkles' | 'flame' | 'sun' | 'moon' | 'crown';

type Design = {
  kind: Kind;
  cup: string; // the cup (or glass) itself
  trim: string; // saucer, stripe, sleeve, lid or straw
  drink: string;
  topping: Topping;
  accent: Accent;
  accentFill: string;
  face: Face;
};

// Extra pastels for the award cups, alongside the theme's latte palette.
const pastel = {
  pink: '#F9CFD9',
  peach: '#FFD9BD',
  mint: '#CDEBD8',
  sage: '#9CC5B5',
  sky: '#CFE3F5',
  blue: '#8DB8E0',
  lavender: '#E1D5F5',
  lilac: '#B9A3E3',
  tan: '#EBD3B8',
  matcha: '#A8C686',
  strawberry: '#F2A7B5',
};

const DESIGNS: Record<string, Design> = {
  'correct-1': { kind: 'latte', cup: pastel.pink, trim: colors.cream, drink: colors.latte, topping: 'heart', accent: 'hearts', accentFill: colors.rose, face: 'smile' },
  'correct-10': { kind: 'mug', cup: pastel.mint, trim: pastel.sage, drink: colors.latte, topping: 'leaf', accent: 'sparkles', accentFill: colors.honey, face: 'grin' },
  'correct-100': { kind: 'togo', cup: pastel.sky, trim: pastel.blue, drink: colors.latte, topping: 'none', accent: 'stars', accentFill: colors.honey, face: 'wink' },
  'correct-300': { kind: 'espresso', cup: pastel.lavender, trim: pastel.lilac, drink: colors.caramel, topping: 'heart', accent: 'crown', accentFill: colors.honey, face: 'joy' },
  'streak-3': { kind: 'mug', cup: pastel.peach, trim: colors.rose, drink: colors.latte, topping: 'heart', accent: 'flame', accentFill: colors.rose, face: 'smile' },
  'streak-7': { kind: 'latte', cup: colors.honeySoft, trim: colors.honey, drink: colors.caramel, topping: 'star', accent: 'sparkles', accentFill: colors.rose, face: 'grin' },
  'streak-30': { kind: 'togo', cup: pastel.tan, trim: colors.caramel, drink: colors.latte, topping: 'none', accent: 'stars', accentFill: colors.honey, face: 'joy' },
  'streak-100': { kind: 'iced', cup: colors.foam, trim: colors.berry, drink: pastel.strawberry, topping: 'none', accent: 'flame', accentFill: colors.honey, face: 'grin' },
  'complete:praxis-slp': { kind: 'latte', cup: pastel.mint, trim: pastel.sage, drink: pastel.matcha, topping: 'leaf', accent: 'crown', accentFill: colors.honey, face: 'joy' },
  'complete:security-plus': { kind: 'mug', cup: pastel.sky, trim: pastel.blue, drink: colors.latte, topping: 'star', accent: 'crown', accentFill: colors.honey, face: 'grin' },
  'perfect-day': { kind: 'espresso', cup: pastel.pink, trim: colors.rose, drink: colors.caramel, topping: 'heart', accent: 'hearts', accentFill: colors.berry, face: 'wink' },
  'full-pot': { kind: 'togo', cup: colors.honeySoft, trim: colors.honey, drink: colors.latte, topping: 'none', accent: 'sparkles', accentFill: colors.rose, face: 'grin' },
  'second-shot': { kind: 'espresso', cup: pastel.mint, trim: pastel.sage, drink: colors.caramel, topping: 'leaf', accent: 'sparkles', accentFill: colors.honey, face: 'smile' },
  'hot-streak': { kind: 'mug', cup: colors.berrySoft, trim: colors.berry, drink: colors.latte, topping: 'heart', accent: 'flame', accentFill: colors.honey, face: 'grin' },
  'catching-up': { kind: 'latte', cup: pastel.peach, trim: colors.cream, drink: colors.latte, topping: 'leaf', accent: 'hearts', accentFill: colors.rose, face: 'smile' },
  'double-major': { kind: 'togo', cup: pastel.lavender, trim: pastel.lilac, drink: colors.latte, topping: 'none', accent: 'stars', accentFill: colors.rose, face: 'joy' },
  'early-bird': { kind: 'iced', cup: colors.foam, trim: pastel.blue, drink: colors.latte, topping: 'none', accent: 'sun', accentFill: colors.honey, face: 'grin' },
  'night-owl': { kind: 'mug', cup: pastel.lavender, trim: pastel.lilac, drink: colors.caramel, topping: 'star', accent: 'moon', accentFill: colors.honey, face: 'sleepy' },
};

const FALLBACK: Design = DESIGNS['correct-1'];

// Not earned yet: a sleepy cup in muted tones.
const LOCKED = { cup: '#F1E7E3', trim: '#DCCDC7', drink: '#CDBDB6', accentFill: '#DCCDC7' };

const INK = colors.espresso;

const HEART = 'M0 6 C-9 -1, -7 -9, 0 -4 C7 -9, 9 -1, 0 6 Z';
const ART_HEART =
  'M0 10 C-14 3, -16 -8, -7 -9.5 C-3 -10, -1 -7.5, 0 -5.5 C1 -7.5, 3 -10, 7 -9.5 C16 -8, 14 3, 0 10 Z';
const SPARKLE = 'M0 -12 C2 -3, 3 -2, 12 0 C3 2, 2 3, 0 12 C-2 3, -3 2, -12 0 C-3 -2, -2 -3, 0 -12 Z';
const FLAME =
  'M0 -13 C5 -7, 10 -2, 9 5 C8 10, 4 13, 0 13 C-4 13, -8 10, -9 5 C-9.5 0, -6 -3, -4 -7 C-3 -3, -1 -2, 1 -3 C2 -6, 1.5 -10, 0 -13 Z';
const MOON = 'M4 -11 C-6 -10, -11 -2, -9 5 C-7 11, 2 14, 8 9 C0 9, -5 3, -4 -3 C-3 -8, 0 -10, 4 -11 Z';
const CROWN = 'M-14 7 L-14 -7 L-7 0 L0 -11 L7 0 L14 -7 L14 7 Z';

function starPath(outer: number, inner: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${points.join(' L')} Z`;
}
const STAR = starPath(12, 5.4);

function AccentShape({ accent, fill }: { accent: Accent; fill: string }) {
  switch (accent) {
    case 'hearts':
      return <Path d={HEART} fill={fill} strokeWidth={2.6} />;
    case 'stars':
      return <Path d={STAR} fill={fill} strokeWidth={2.4} />;
    case 'sparkles':
      return <Path d={SPARKLE} fill={fill} strokeWidth={2.4} />;
    case 'flame':
      return <Path d={FLAME} fill={fill} strokeWidth={2.4} />;
    case 'moon':
      return <Path d={MOON} fill={fill} strokeWidth={2.4} />;
    case 'sun':
      return (
        <G>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return (
              <Path
                key={i}
                d={`M${(9 * Math.cos(a)).toFixed(2)} ${(9 * Math.sin(a)).toFixed(2)} L${(13 * Math.cos(a)).toFixed(2)} ${(13 * Math.sin(a)).toFixed(2)}`}
                strokeWidth={2.4}
              />
            );
          })}
          <Circle r={6} fill={fill} strokeWidth={2.4} />
        </G>
      );
    case 'crown':
      return (
        <G>
          <Path d={CROWN} fill={fill} strokeWidth={2.4} />
          <Circle cx={0} cy={-11} r={2} fill={colors.rose} strokeWidth={1.4} />
        </G>
      );
  }
}

// Steam and floating accents above the cup.
function Topper({ accent, fill, steam }: { accent: Accent; fill: string; steam: number | null }) {
  if (accent === 'crown') {
    return (
      <G transform="translate(100 34) scale(1.5)">
        <AccentShape accent={accent} fill={fill} />
      </G>
    );
  }
  return (
    <G>
      {steam !== null && (
        <Path
          d={`M100 ${steam} C94 ${steam - 8}, 106 ${steam - 12}, 100 ${steam - 22} C95 ${steam - 30}, 104 ${steam - 34}, 100 ${steam - 40}`}
          strokeWidth={4}
          fill="none"
          opacity={0.35}
        />
      )}
      <G transform="translate(42 38) rotate(-14) scale(1.15)">
        <AccentShape accent={accent} fill={fill} />
      </G>
      <G transform="translate(160 28) rotate(12) scale(0.85)">
        <AccentShape accent={accent} fill={fill} />
      </G>
    </G>
  );
}

function LatteArt({ topping, x, y, scale }: { topping: Topping; x: number; y: number; scale: number }) {
  const transform = `translate(${x} ${y}) scale(${scale})`;
  switch (topping) {
    case 'heart':
      return <Path d={ART_HEART} transform={transform} fill={colors.cream} stroke="none" />;
    case 'star':
      return <Path d={STAR} transform={`${transform} scale(1 0.75)`} fill={colors.cream} stroke="none" />;
    case 'leaf':
      return (
        <G transform={`${transform} scale(1.5 0.8)`}>
          <Path d="M-11 0 C-6 -9, 6 -9, 11 0 C6 9, -6 9, -11 0 Z" fill={colors.cream} stroke="none" />
          <Path d="M-8 0 C-3 -1.5, 3 -1.5, 9 0" stroke={colors.latte} strokeWidth={1.6} fill="none" />
        </G>
      );
    case 'none':
      return null;
  }
}

function FaceShape({ face, x, y, scale }: { face: Face; x: number; y: number; scale: number }) {
  const closedEye = (cx: number) => `M${cx - 8} 3 C${cx - 4} -6, ${cx + 4} -6, ${cx + 8} 3`;
  const sleepyEye = (cx: number) => `M${cx - 8} -1 C${cx - 4} 5, ${cx + 4} 5, ${cx + 8} -1`;
  const openEye = (cx: number, key: string) => (
    <G key={key} stroke="none">
      <Ellipse cx={cx} cy={0} rx={7.5} ry={8.5} fill={INK} />
      <Circle cx={cx + 2.5} cy={-3.5} r={2.8} fill={colors.white} />
      <Circle cx={cx - 2.5} cy={3.5} r={1.3} fill={colors.white} />
    </G>
  );

  let eyes: ReactNode;
  if (face === 'joy') {
    eyes = <Path d={`${closedEye(-22)} ${closedEye(22)}`} fill="none" strokeWidth={4} />;
  } else if (face === 'sleepy') {
    eyes = <Path d={`${sleepyEye(-22)} ${sleepyEye(22)}`} fill="none" strokeWidth={4} />;
  } else if (face === 'wink') {
    eyes = (
      <>
        {openEye(-22, 'left')}
        <Path d={closedEye(22)} fill="none" strokeWidth={4} />
      </>
    );
  } else {
    eyes = [openEye(-22, 'left'), openEye(22, 'right')];
  }

  const mouth =
    face === 'grin' || face === 'joy' ? (
      <Path d="M-10 7 C-9 19, 9 19, 10 7 Z" fill={colors.berry} strokeWidth={3.2} />
    ) : face === 'sleepy' ? (
      <Path d="M-5 9 C-3 13, 3 13, 5 9" fill="none" strokeWidth={3.2} />
    ) : (
      <Path d="M-8 8 C-6 15, 6 15, 8 8" fill={colors.berry} strokeWidth={3.5} />
    );

  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      {eyes}
      <Ellipse cx={-38} cy={12} rx={9} ry={5} fill={colors.rose} opacity={0.75} stroke="none" />
      <Ellipse cx={38} cy={12} rx={9} ry={5} fill={colors.rose} opacity={0.75} stroke="none" />
      {mouth}
    </G>
  );
}

function Latte({ d }: { d: Design }) {
  const handle = 'M154 92 C186 88, 186 136, 146 136';
  return (
    <>
      <Topper accent={d.accent} fill={d.accentFill} steam={52} />
      <Ellipse cx={100} cy={166} rx={74} ry={15} fill={d.trim} strokeWidth={5} />
      <Ellipse cx={100} cy={163} rx={44} ry={7} fill={INK} opacity={0.12} stroke="none" />
      <Path d={handle} fill="none" strokeWidth={22} />
      <Path d={handle} fill="none" stroke={d.cup} strokeWidth={11} />
      <Path d="M36 80 C36 134, 62 162, 100 162 C138 162, 164 134, 164 80 Z" fill={d.cup} strokeWidth={5} />
      <Path d="M56 140 C68 152, 84 156, 100 156" fill="none" stroke={colors.white} strokeWidth={5} opacity={0.6} />
      <Ellipse cx={100} cy={80} rx={64} ry={20} fill={d.cup} strokeWidth={5} />
      <Ellipse cx={100} cy={81} rx={53} ry={14} fill={d.drink} strokeWidth={3} />
      <LatteArt topping={d.topping} x={100} y={82} scale={1} />
      <FaceShape face={d.face} x={100} y={116} scale={1} />
    </>
  );
}

function Mug({ d }: { d: Design }) {
  const handle = 'M146 94 C180 92, 180 138, 146 136';
  return (
    <>
      <Topper accent={d.accent} fill={d.accentFill} steam={56} />
      <Ellipse cx={96} cy={168} rx={60} ry={8} fill={INK} opacity={0.12} stroke="none" />
      <Path d={handle} fill="none" strokeWidth={22} />
      <Path d={handle} fill="none" stroke={d.cup} strokeWidth={11} />
      <Path
        d="M44 76 L44 140 C44 155, 55 164, 70 164 L122 164 C137 164, 148 155, 148 140 L148 76 Z"
        fill={d.cup}
        strokeWidth={5}
      />
      <Path d="M46 142 L146 142" stroke={d.trim} strokeWidth={9} />
      <Path d="M46 136.5 L146 136.5 M46 147.5 L146 147.5" strokeWidth={2.5} />
      <Ellipse cx={96} cy={76} rx={52} ry={15} fill={d.cup} strokeWidth={5} />
      <Ellipse cx={96} cy={77} rx={42} ry={10} fill={d.drink} strokeWidth={3} />
      <LatteArt topping={d.topping} x={96} y={77} scale={0.75} />
      <FaceShape face={d.face} x={96} y={106} scale={0.9} />
    </>
  );
}

function ToGo({ d }: { d: Design }) {
  return (
    <>
      <Topper accent={d.accent} fill={d.accentFill} steam={null} />
      <Ellipse cx={100} cy={176} rx={46} ry={7} fill={INK} opacity={0.12} stroke="none" />
      <Path d="M50 66 L63 166 C64 171, 67 173, 72 173 L128 173 C133 173, 136 171, 137 166 L150 66 Z" fill={d.cup} strokeWidth={5} />
      <Path d="M57.4 120 L142.6 120 L138.8 149 L61.2 149 Z" fill={d.trim} strokeWidth={4} />
      <Path d={HEART} transform="translate(100 135) scale(0.9)" fill={colors.cream} strokeWidth={2.4} />
      <Path d="M60 44 C62 35, 74 31, 100 31 C126 31, 138 35, 140 44 Z" fill={d.trim} strokeWidth={5} />
      <Rect x={36} y={44} width={128} height={22} rx={10} fill={d.trim} strokeWidth={5} />
      <Path d="M48 55 L152 55" stroke={colors.white} strokeWidth={3} opacity={0.5} />
      <FaceShape face={d.face} x={100} y={90} scale={0.85} />
    </>
  );
}

function Iced({ d }: { d: Design }) {
  const glass = 'M52 56 L65 168 C66 174, 71 177, 78 177 L122 177 C129 177, 134 174, 135 168 L148 56 Z';
  return (
    <>
      <Topper accent={d.accent} fill={d.accentFill} steam={null} />
      <Ellipse cx={100} cy={180} rx={46} ry={6} fill={INK} opacity={0.12} stroke="none" />
      <Path d={glass} fill={d.cup} stroke="none" />
      <Path d="M112 100 L124 34 L146 22" fill="none" strokeWidth={13} />
      <Path d="M112 100 L124 34 L146 22" fill="none" stroke={d.trim} strokeWidth={6} />
      <Path d="M58 84 L68 166 C69 170, 72 172, 78 172 L122 172 C128 172, 131 170, 132 166 L142 84 Z" fill={d.drink} stroke="none" />
      <Path d="M58 84 L142 84 L141 92 L59 92 Z" fill={colors.cream} opacity={0.7} stroke="none" />
      <Rect x={66} y={64} width={26} height={26} rx={6} fill={colors.white} opacity={0.85} strokeWidth={3} transform="rotate(-12 79 77)" />
      <Rect x={92} y={60} width={24} height={24} rx={6} fill={colors.white} opacity={0.85} strokeWidth={3} transform="rotate(10 104 72)" />
      <Path d={glass} fill="none" strokeWidth={5} />
      <Path d="M62 70 L71 150" stroke={colors.white} strokeWidth={4} opacity={0.7} />
      <FaceShape face={d.face} x={100} y={124} scale={0.85} />
    </>
  );
}

function Espresso({ d }: { d: Design }) {
  const handle = 'M140 108 C166 104, 166 140, 134 138';
  return (
    <>
      <Topper accent={d.accent} fill={d.accentFill} steam={84} />
      <Ellipse cx={100} cy={160} rx={70} ry={14} fill={d.trim} strokeWidth={5} />
      <Ellipse cx={100} cy={157} rx={40} ry={6} fill={INK} opacity={0.12} stroke="none" />
      <Path d={handle} fill="none" strokeWidth={20} />
      <Path d={handle} fill="none" stroke={d.cup} strokeWidth={9} />
      <Path d="M52 100 C52 140, 72 156, 100 156 C128 156, 148 140, 148 100 Z" fill={d.cup} strokeWidth={5} />
      <Ellipse cx={100} cy={100} rx={48} ry={14} fill={d.cup} strokeWidth={5} />
      <Ellipse cx={100} cy={101} rx={39} ry={9} fill={d.drink} strokeWidth={3} />
      <LatteArt topping={d.topping} x={100} y={101} scale={0.65} />
      <FaceShape face={d.face} x={100} y={126} scale={0.75} />
    </>
  );
}

const CUPS: Record<Kind, (props: { d: Design }) => ReactNode> = {
  latte: Latte,
  mug: Mug,
  togo: ToGo,
  iced: Iced,
  espresso: Espresso,
};

type Props = { award: string; size?: number; locked?: boolean };

export function CoffeeBadge({ award, size = 72, locked = false }: Props) {
  const design = DESIGNS[award] ?? FALLBACK;
  const paint: Design = locked ? { ...design, ...LOCKED, face: 'sleepy' } : design;
  const Cup = CUPS[design.kind];
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
      <G stroke={INK} strokeLinecap="round" strokeLinejoin="round" opacity={locked ? 0.6 : 1}>
        <Cup d={paint} />
      </G>
    </Svg>
  );
}
