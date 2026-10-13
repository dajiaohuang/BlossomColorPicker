import {
  BLOOM_CLOSE_EASING,
  COLLAPSE_DELAY,
  COLLAPSE_DURATION,
  PETAL_CLOSE_DELAY,
  PETAL_CLOSE_DURATION,
  PETAL_CLOSE_EASING,
  PETAL_COLLAPSED_SCALE,
  PETAL_FADE_DURATION,
  PETAL_START_RADIUS,
  PETAL_TRAVEL_DURATION,
  bloomTime,
} from '../constants';
import { createElement, setStyles } from '../dom-helpers';
import { hslToString, hslaToString } from '../utils';

export interface PetalConfig {
  hue: number;
  saturation: number;
  lightness: number;
  index: number;
  totalPetals: number;
  petalSize: number;
  radius: number;
  animationDuration: number;
  staggerDelay: number;
  openEasing: string;
  zIndex: number;
  rotationOffset: number;
  alpha: number;
  clip?: 'left' | 'right';
  pointerEvents: 'auto' | 'none';
  hasShadow: boolean;
  noRing?: boolean;
}

export class PetalRenderer {
  public el: HTMLButtonElement;
  private config: PetalConfig;
  private isHovered = false;
  private bloomEndTime = 0;

  constructor(
    config: PetalConfig,
    private onClick?: () => void,
    private onMouseEnter?: () => void,
    private onMouseLeave?: () => void
  ) {
    this.config = config;
    this.el = createElement('button', undefined, {
      type: 'button',
      'aria-label': `Select color hue ${config.hue}`,
      tabIndex: '-1',
    });
    this.el.className = 'bcp-petal';

    if (config.alpha !== 0) {
      this.el.classList.add('bcp-petal-visible');
    }

    this.el.addEventListener('click', () => this.onClick?.());
    this.el.addEventListener('mouseenter', () => {
      this.isHovered = true;
      this.onMouseEnter?.();
      this.updateStyles(this.lastExpanded);
    });
    this.el.addEventListener('mouseleave', () => {
      this.isHovered = false;
      this.onMouseLeave?.();
      this.updateStyles(this.lastExpanded);
    });

    this.applyBaseStyles();
    this.updateStyles(false);
  }

  private lastExpanded = false;

  private applyBaseStyles(): void {
    const { petalSize, config: c } = {
      petalSize: this.config.petalSize,
      config: this.config,
    };
    setStyles(this.el, {
      position: 'absolute',
      width: `${petalSize}px`,
      height: `${petalSize}px`,
      borderRadius: '50%',
      border: 'none',
      padding: '0',
      background: 'none',
      left: '50%',
      top: '50%',
      marginLeft: `${-petalSize / 2}px`,
      marginTop: `${-petalSize / 2}px`,
      transformOrigin: 'center center',
      willChange: 'transform, scale, opacity',
    });

    // Use strict 50% split. The Underlay petal will handle the gap seam.
    if (c.clip === 'left') {
      this.el.style.clipPath = 'polygon(0% -50%, 50% -50%, 50% 150%, 0% 150%)';
    } else if (c.clip === 'right') {
      this.el.style.clipPath =
        'polygon(50% -50%, 100% -50%, 100% 150%, 50% 150%)';
    }
  }

  update(
    isExpanded: boolean,
    externalHover?: boolean,
    mousePos?: { x: number; y: number } | null
  ): void {
    if (externalHover !== undefined) {
      this.isHovered = externalHover;
    }
    this.updateStyles(isExpanded, mousePos);
  }

  private updateStyles(
    isExpanded: boolean,
    mousePos?: { x: number; y: number } | null
  ): void {
    const isExpanding = isExpanded && !this.lastExpanded;
    const c = this.config;
    const isHovered = this.isHovered;
    const isInvisible = c.alpha === 0;
    const t = (ms: number) => bloomTime(ms, c.animationDuration);
    // Opening: petals fan out one after another.
    // Closing: they hold while the ring fades, then fold back together.
    const duration = t(
      isExpanded ? PETAL_TRAVEL_DURATION : PETAL_CLOSE_DURATION
    );
    const easing = isExpanded ? c.openEasing : PETAL_CLOSE_EASING;
    const delay = isExpanded ? c.staggerDelay : t(PETAL_CLOSE_DELAY);
    // Size and opacity only change during the fold itself, after the wind-up.
    const fadeDuration = t(
      isExpanded ? PETAL_FADE_DURATION : COLLAPSE_DURATION
    );
    const fadeDelay = isExpanded ? delay : t(COLLAPSE_DELAY);

    if (isExpanding) {
      this.bloomEndTime = performance.now() + delay + duration;
    } else if (!isExpanded) {
      this.bloomEndTime = 0;
    }
    const isBlooming = isExpanded && performance.now() < this.bloomEndTime;

    // Final bloom position
    const finalAngle = (c.index / c.totalPetals) * 360 - 90 + c.rotationOffset;
    const finalRadian = (finalAngle * Math.PI) / 180;
    let x = Math.cos(finalRadian) * c.radius;
    let y = Math.sin(finalRadian) * c.radius;

    // Petals begin near the center and travel straight outward.
    const startRadian = finalRadian;
    const startRadius = c.radius * PETAL_START_RADIUS;
    const startX = Math.cos(startRadian) * startRadius;
    const startY = Math.sin(startRadian) * startRadius;

    // Subtle push effect when expanded and user moves mouse
    if (isExpanded && !isBlooming && mousePos && !isHovered && !isInvisible) {
      const dx = x - mousePos.x;
      const dy = y - mousePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDistance = 60;

      if (dist < minDistance) {
        const pushStrength = (1 - dist / minDistance) * 6;
        const pushAngle = Math.atan2(dy, dx);
        x += Math.cos(pushAngle) * pushStrength;
        y += Math.sin(pushAngle) * pushStrength;
      }
    }

    const color =
      c.alpha < 1
        ? hslaToString(c.hue, c.saturation, c.lightness, c.alpha * 100)
        : hslToString(c.hue, c.saturation, c.lightness);

    const scale = isHovered && !isBlooming ? 1.1 : 1;

    // Use fast transition when hovering/moving mouse while already expanded
    const transformTransition =
      isExpanded && !isBlooming && mousePos && !isHovered
        ? 'transform 150ms ease-out'
        : `transform ${duration}ms ${easing} ${delay}ms`;

    const transform = isExpanded
      ? `translate(${x}px, ${y}px)`
      : `translate(${startX}px, ${startY}px)`;
    const scaleTransition =
      isExpanded && !isBlooming
        ? 'scale 150ms ease-out'
        : `scale ${fadeDuration}ms ${isExpanded ? 'ease-out' : BLOOM_CLOSE_EASING} ${fadeDelay}ms`;

    setStyles(this.el, {
      backgroundColor: color,
      transform,
      scale: isExpanded ? String(scale) : String(PETAL_COLLAPSED_SCALE),
      opacity: isExpanded ? '1' : '0',
      filter: isHovered && !isInvisible ? 'brightness(1.1)' : 'brightness(1)',
      transition: `${transformTransition},
                   ${scaleTransition},
                   opacity ${fadeDuration}ms linear ${fadeDelay}ms,
                   background-color 200ms ease,
                   box-shadow 200ms ease,
                   filter 200ms ease`,
      boxShadow:
        c.hasShadow && !isInvisible
          ? isHovered
            ? '0 4px 12px rgba(0,0,0,0.25)'
            : '0 2px 6px rgba(0,0,0,0.15)'
          : 'none',
      zIndex: String(c.zIndex),
      pointerEvents: isExpanded ? c.pointerEvents : 'none',
    });

    this.el.tabIndex = isExpanded ? 0 : -1;
    this.lastExpanded = isExpanded;
  }

  destroy(): void {
    this.el.remove();
  }
}
