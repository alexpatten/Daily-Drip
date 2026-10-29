import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View, type HostInstance } from 'react-native';

import { awardShareMessage, type Award } from '@/lib/awards';
import {
  captureForSharing,
  releaseImage,
  shareImage,
  shareWithLink,
  SITE_URL,
  type ShareImage,
} from '@/lib/share';
import { colors, fonts, radius, shadow } from '@/theme';
import { Button } from './Button';
import { CoffeeBadge } from './CoffeeBadge';

export type ShareCard = { kind: 'award'; award: Award } | { kind: 'streak'; days: number };

const MAX_CARD_SIZE = 300;
// The panel's padding plus the screen's side gutter, on each side.
const SHEET_INSET = 16 + 16;
// Give the card a moment to draw (fonts, the cup's SVG) before taking its picture.
const CAPTURE_DELAY_MS = 250;

const dayCount = (days: number) => `${days} ${days === 1 ? 'day' : 'days'}`;

function messageFor(card: ShareCard): string {
  return card.kind === 'award'
    ? awardShareMessage(card.award)
    : `I'm on a ${card.days}-day streak on Daily Drip ☕`;
}

function fileNameFor(card: ShareCard): string {
  return card.kind === 'award'
    ? `daily-drip-${card.award.id.replace(':', '-')}`
    : `daily-drip-streak-${card.days}`;
}

// The picture that gets shared: square, with the app's name and address on it.
function CardArt({ card, size }: { card: ShareCard; size: number }) {
  const halo = size * 0.46;
  const words =
    card.kind === 'award'
      ? { label: 'Award unlocked', title: card.award.name, subtitle: card.award.description }
      : { label: 'Day streak', title: `${dayCount(card.days)} in a row`, subtitle: 'One practice question a day, every day.' };
  return (
    <View style={[styles.card, { width: size, height: size }]}>
      <Text style={styles.brand}>Daily Drip</Text>
      <View style={[styles.halo, { width: halo, height: halo, borderRadius: halo / 2 }]}>
        {card.kind === 'award' ? (
          <CoffeeBadge award={card.award.id} size={halo * 0.86} />
        ) : (
          <Text style={[styles.days, { fontSize: halo * 0.46 }]}>{card.days}</Text>
        )}
      </View>
      <View style={styles.words}>
        <Text style={styles.label}>{words.label}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {words.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {words.subtitle}
        </Text>
      </View>
      <Text style={styles.site}>{SITE_URL.replace(/^https:\/\//, '')}</Text>
    </View>
  );
}

type Props = { card: ShareCard | null; onClose: () => void };

/** A preview of the picture to share, with a button to share it. */
export function ShareSheet({ card, onClose }: Props) {
  return (
    <Modal visible={!!card} transparent animationType="fade" onRequestClose={onClose}>
      {card && <SheetBody card={card} onClose={onClose} />}
    </Modal>
  );
}

function SheetBody({ card, onClose }: { card: ShareCard; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const size = Math.min(MAX_CARD_SIZE, width - SHEET_INSET * 2);
  const art = useRef<HostInstance>(null);
  const [image, setImage] = useState<ShareImage | null>(null);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Take the picture while the preview is up, so it's ready when Share is tapped. (Browsers
  // only open the share sheet right after a tap.)
  useEffect(() => {
    let cancelled = false;
    let taken: ShareImage | null = null;
    const timer = setTimeout(() => {
      captureForSharing(art, fileNameFor(card)).then(
        (picture) => {
          if (cancelled) return releaseImage(picture);
          taken = picture;
          setImage(picture);
        },
        () => !cancelled && setCaptureFailed(true),
      );
    }, CAPTURE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (taken) releaseImage(taken);
    };
  }, [card]);

  async function share() {
    setSharing(true);
    const message = messageFor(card);
    // Without a picture, the words and link still go.
    const result = image ? await shareImage(image, message) : await shareWithLink(message);
    setSharing(false);
    if (result === 'shared') onClose();
    else if (result === 'saved') setNote('Picture saved. Share it anywhere ♡');
    else if (result === 'copied') setNote('Copied to share ♡');
    else if (result === 'failed') setNote("Couldn't open sharing. Try again?");
  }

  return (
    <View style={styles.backdrop} accessibilityViewIsModal>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={styles.sheet}>
        <View style={styles.frame}>
          <View
            ref={art}
            collapsable={false}
            accessible
            accessibilityRole="image"
            accessibilityLabel={messageFor(card)}
          >
            <CardArt card={card} size={size} />
          </View>
        </View>
        {note && <Text style={styles.note}>{note}</Text>}
        <Button label="Share" loading={sharing || (!image && !captureFailed)} onPress={share} />
        <Button label="Not now" variant="text" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74, 46, 34, 0.45)',
  },
  sheet: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    ...shadow,
  },
  frame: { borderRadius: radius.md, overflow: 'hidden' },
  // No rounded corners on the picture itself, so it has no see-through edges.
  card: {
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  brand: { fontFamily: fonts.display, fontSize: 20, color: colors.espresso },
  halo: { backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  days: { fontFamily: fonts.display, color: colors.caramel },
  words: { alignItems: 'center', gap: 2 },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.caramel,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  subtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: colors.mocha, textAlign: 'center' },
  site: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.mocha },
  note: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.caramel, textAlign: 'center' },
});
