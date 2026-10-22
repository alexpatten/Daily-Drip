import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { colors } from '@/theme';

const HEART = 'M0 6 C-9 -1, -7 -9, 0 -4 C7 -9, 9 -1, 0 6 Z';
const HANDLE = 'M154 92 C186 88, 186 136, 146 136';

// A kawaii latte cup with a little face, heart latte art and floating hearts.
export function LatteHearts({ size = 200 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityLabel="Smiling latte with hearts">
      <G stroke={colors.espresso} strokeLinecap="round" strokeLinejoin="round">
        {/* steam + floating hearts */}
        <Path
          d="M100 52 C94 44, 106 40, 100 30 C95 22, 104 18, 100 12"
          strokeWidth={4}
          fill="none"
          opacity={0.35}
        />
        <Path d={HEART} transform="translate(66 38) rotate(-14) scale(1.1)" fill={colors.rose} strokeWidth={2.6} />
        <Path d={HEART} transform="translate(136 30) rotate(12) scale(0.8)" fill={colors.rose} strokeWidth={3} />

        {/* saucer */}
        <Ellipse cx={100} cy={166} rx={74} ry={15} fill={colors.cream} strokeWidth={5} />
        <Ellipse cx={100} cy={163} rx={44} ry={7} fill={colors.blushDeep} stroke="none" />

        {/* handle: thick outline with a foam core */}
        <Path d={HANDLE} fill="none" strokeWidth={22} />
        <Path d={HANDLE} fill="none" stroke={colors.foam} strokeWidth={11} />

        {/* cup */}
        <Path d="M36 80 C36 134, 62 162, 100 162 C138 162, 164 134, 164 80 Z" fill={colors.foam} strokeWidth={5} />
        <Path d="M56 140 C68 152, 84 156, 100 156" fill="none" stroke={colors.blushDeep} strokeWidth={5} />

        {/* rim, coffee, heart latte art */}
        <Ellipse cx={100} cy={80} rx={64} ry={20} fill={colors.foam} strokeWidth={5} />
        <Ellipse cx={100} cy={81} rx={53} ry={14} fill={colors.latte} strokeWidth={3} />
        <Path
          d="M100 92 C86 85, 84 74, 93 72.5 C97 72, 99 74.5, 100 76.5 C101 74.5, 103 72, 107 72.5 C116 74, 114 85, 100 92 Z"
          fill={colors.cream}
          stroke="none"
        />

        {/* face */}
        <G stroke="none">
          <Ellipse cx={78} cy={116} rx={7.5} ry={8.5} fill={colors.espresso} />
          <Ellipse cx={122} cy={116} rx={7.5} ry={8.5} fill={colors.espresso} />
          <Circle cx={80.5} cy={112.5} r={2.8} fill={colors.white} />
          <Circle cx={124.5} cy={112.5} r={2.8} fill={colors.white} />
          <Circle cx={75.5} cy={119.5} r={1.3} fill={colors.white} />
          <Circle cx={119.5} cy={119.5} r={1.3} fill={colors.white} />
          <Ellipse cx={62} cy={128} rx={9} ry={5} fill={colors.rose} opacity={0.75} />
          <Ellipse cx={138} cy={128} rx={9} ry={5} fill={colors.rose} opacity={0.75} />
        </G>
        <Path d="M92 124 C94 131, 106 131, 108 124" fill={colors.berry} strokeWidth={3.5} />
      </G>
    </Svg>
  );
}
