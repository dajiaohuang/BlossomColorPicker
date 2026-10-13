export const OUTER_COLORS = [
  { h: 47, s: 97, l: 65 }, // #FCD752
  { h: 37, s: 98, l: 65 }, // #FDBA50
  { h: 27, s: 95, l: 64 }, // #FA9C4D
  { h: 14, s: 90, l: 64 }, // #F6774F
  { h: 0, s: 85, l: 64 }, // #F15656
  { h: 327, s: 75, l: 62 }, // #E756A6
  { h: 285, s: 51, l: 59 }, // #B261CC
  { h: 257, s: 65, l: 64 }, // #8966DF
  { h: 225, s: 71, l: 65 }, // #6586E5
  { h: 202, s: 68, l: 65 }, // #69B5E2
  { h: 151, s: 43, l: 63 }, // #77C9A2
  { h: 96, s: 49, l: 67 }, // #A4D483
];

export const INNER_COLORS = [
  { h: 50, s: 95, l: 85 }, // #FDF1B6
  { h: 26, s: 89, l: 89 }, // #FCE0CA
  { h: 345, s: 77, l: 88 }, // #F8C8D4
  { h: 283, s: 47, l: 84 }, // #DEC2E9
  { h: 209, s: 70, l: 87 }, // #C6DEF5
  { h: 116, s: 42, l: 87 }, // #D2ECD0
];

export const DEFAULT_COLORS = [...INNER_COLORS, ...OUTER_COLORS];

// Bloom timeline. Every value below is in milliseconds at
// DEFAULT_ANIMATION_DURATION and is scaled with `bloomTime()` for other durations.
export const DEFAULT_ANIMATION_DURATION = 280;

export function bloomTime(ms: number, animationDuration: number): number {
  return Math.round((ms * animationDuration) / DEFAULT_ANIMATION_DURATION);
}

// --- Open ---
// The whole flower swells from a smaller disc while the petals fan out.
export const BLOOM_COLLAPSED_SCALE = 0.72;
export const BLOOM_SCALE_DELAY = 15;
export const BLOOM_SCALE_DURATION = 105;
export const BLOOM_OPEN_EASING = 'cubic-bezier(0.5, 0, 0.5, 1)';
export const DISC_FADE_DURATION = 120;

// Each layer fans open over the same window; the outermost layer sweeps
// clockwise and every layer inside it alternates direction.
export const PETAL_SWEEP = 210;
export const PETAL_SWEEP_EASE = 1.3;
export const PETAL_TRAVEL_DURATION = 340;
export const PETAL_FADE_DURATION = 80;
export const PETAL_START_RADIUS = 0.5;
export const PETAL_COLLAPSED_SCALE = 0.7;
// Jelly landing: a petal shoots past its resting spot and eases back. The first
// petals of a sweep overshoot the most; the last ones barely do.
export const PETAL_OVERSHOOT_FIRST = 0.15;
export const PETAL_OVERSHOOT_LAST = 0.04;

// [time %, travel, share of the overshoot]
const PETAL_SPRING_SHAPE: [number, number, number][] = [
  [0, 0, 0],
  [8, 0.2, 0],
  [17, 0.45, 0],
  [25, 0.75, 0],
  [32, 0.93, 0],
  [36, 1, 0],
  [42, 1, 0.55],
  [50, 1, 0.87],
  [58, 1, 1],
  [66, 1, 0.87],
  [75, 1, 0.55],
  [84, 1, 0.2],
  [92, 1, 0.07],
  [100, 1, 0],
];

export function petalSpringEasing(overshoot: number): string {
  const stops = PETAL_SPRING_SHAPE.map(
    ([time, travel, share]) =>
      `${(travel + share * overshoot).toFixed(3)} ${time}%`
  );
  return `linear(${stops.join(', ')})`;
}

// The ring and the slider are the second and third beat of the bloom.
// The ring (and the disc behind it) wobbles on top of the container scale:
// it swells ~3% past full size, dips ~2.5% under it, then settles.
export const RING_COLLAPSED_SCALE = 0.97;
export const RING_SPRING_DURATION = 490;
export const RING_SPRING_EASING =
  'linear(0, 0.9 10%, 1.7 20%, 2 27%, 1.95 34%, 1.5 39%, 1 43%, 0.5 50%, 0.22 58%, 0.15 66%, 0.25 74%, 0.5 84%, 0.8 93%, 1)';
export const RING_FADE_DELAY = 90;
export const RING_FADE_DURATION = 170;
export const SLIDER_FADE_DELAY = 180;
export const SLIDER_FADE_DURATION = 200;

// --- Close ---
// Slider and ring fade out in place, then the flower folds back as one piece.
export const SLIDER_CLOSE_DURATION = 70;
export const RING_CLOSE_DELAY = 30;
export const RING_CLOSE_DURATION = 150;
export const COLLAPSE_DELAY = 190;
export const COLLAPSE_DURATION = 180;
export const BLOOM_CLOSE_EASING = 'cubic-bezier(0.4, 0, 0.6, 1)';
export const TRIGGER_FADE_DURATION = 80;

// Jelly on the way out, mirroring the bloom:
// the ring swells before it lets go, the petals wind up outward before they
// fold, and the trigger pops back in past full size.
export const RING_CLOSE_SPRING_DURATION = 180;
export const RING_CLOSE_SPRING_EASING =
  'linear(0, -0.6 14%, -1 30%, -0.85 44%, -0.2 62%, 0.5 80%, 1)';
export const PETAL_CLOSE_DELAY = 100;
export const PETAL_CLOSE_DURATION = 270;
export const PETAL_CLOSE_EASING =
  'linear(0, -0.05 10%, -0.11 22%, -0.13 31%, -0.09 40%, 0.08 50%, 0.36 61%, 0.66 72%, 0.87 83%, 0.97 92%, 1)';
export const TRIGGER_COLLAPSED_SCALE = 0.6;
export const TRIGGER_POP_DELAY = 340;
export const TRIGGER_POP_DURATION = 180;
export const TRIGGER_POP_EASING =
  'linear(0, 0.6 22%, 1.05 42%, 1.16 56%, 1.12 68%, 1.03 84%, 1)';

export const HOVER_DELAY = 100;

export const BAR_GAP = 20;
export const BAR_WIDTH = 12;
export const SLIDER_OFFSET = 30;
export const ARC_GRADIENT_STEPS = 11; // Number of gradient stops for smooth arc
