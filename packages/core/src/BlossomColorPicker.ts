import type {
  BlossomColorPickerValue,
  BlossomColorPickerColor,
  ColorInput,
  SliderPosition,
} from './types';

function colorsEqual(a: ColorInput[], b: ColorInput[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function clockwiseHueOrder(hue: number): number {
  return (50 - hue + 360) % 360;
}

import { computeAdaptivePosition } from './adaptive';
import {
  DEFAULT_COLORS,
  DEFAULT_ANIMATION_DURATION,
  BLOOM_OPEN_EASING,
  BLOOM_CLOSE_EASING,
  BLOOM_COLLAPSED_SCALE,
  BLOOM_SCALE_DELAY,
  BLOOM_SCALE_DURATION,
  COLLAPSE_DELAY,
  COLLAPSE_DURATION,
  TRIGGER_FADE_DURATION,
  TRIGGER_COLLAPSED_SCALE,
  TRIGGER_POP_DELAY,
  TRIGGER_POP_DURATION,
  TRIGGER_POP_EASING,
  PETAL_SWEEP,
  PETAL_SWEEP_EASE,
  PETAL_OVERSHOOT_FIRST,
  PETAL_OVERSHOOT_LAST,
  petalSpringEasing,
  HOVER_DELAY,
  bloomTime,
  BAR_GAP,
  BAR_WIDTH,
  SLIDER_OFFSET,
} from './constants';
import { createElement, setStyles } from './dom-helpers';
import {
  calculateLayerRadii,
  calculateLayerRotations,
  calculateBarRadius,
  calculateContainerSize,
  getPetalZIndex,
} from './layout';
import { ArcSliderRenderer } from './renderers/ArcSliderRenderer';
import { BackgroundRenderer } from './renderers/BackgroundRenderer';
import { ColorBarRenderer } from './renderers/ColorBarRenderer';
import { CoreButtonRenderer } from './renderers/CoreButtonRenderer';
import { PetalRenderer } from './renderers/PetalRenderer';
import {
  lightnessToSliderValue,
  sliderValueToLightness,
  hslaToString,
  createColorOutput,
  organizeColorsIntoLayers,
  getVisualSaturation,
  parseColor,
} from './utils';

export interface BlossomColorPickerOptions {
  value?: BlossomColorPickerValue;
  defaultValue?: BlossomColorPickerValue;
  colors?: ColorInput[];
  onChange?: (color: BlossomColorPickerColor) => void;
  onCollapse?: (color: BlossomColorPickerColor) => void;
  disabled?: boolean;
  openOnHover?: boolean;
  initialExpanded?: boolean;
  animationDuration?: number;
  showAlphaSlider?: boolean;
  coreSize?: number;
  petalSize?: number;
  showCoreColor?: boolean;
  sliderPosition?: SliderPosition;
  adaptivePositioning?: boolean;
  circularBarWidth?: number;
  sliderWidth?: number;
  sliderOffset?: number;
  collapsible?: boolean;
}

const DEFAULT_VALUE: BlossomColorPickerValue = {
  hue: 330,
  saturation: 70,
  alpha: 50,
  layer: 'outer',
};

export class BlossomColorPicker {
  private container: HTMLElement;
  private rootEl!: HTMLDivElement;
  private containerEl!: HTMLDivElement;
  private mousePos: { x: number; y: number } | null = null;
  private rafId: number | null = null;

  private triggerBtn: HTMLButtonElement | null = null;
  private isFirstRender = true;

  // Options
  private opts: Required<
    Omit<BlossomColorPickerOptions, 'value' | 'defaultValue' | 'sliderPosition'>
  > & {
    sliderPosition?: SliderPosition;
  };

  // State
  private internalValue: BlossomColorPickerValue;
  private controlledValue?: BlossomColorPickerValue;
  private isExpanded = false;
  private isHovering = false;
  private hoveredPetal: { layer: number; index: number } | null = null;
  private prevExpanded = false;
  private shiftOffset = { x: 0, y: 0 };
  private effectivePosition: SliderPosition = 'right';

  // Computed
  private normalizedColors: { h: number; s: number; l: number }[] = [];
  private layers: { h: number; s: number; l: number }[][] = [];
  private allColors: { h: number; s: number; l: number }[] = [];
  private layerPrefixCounts: number[] = [];
  private layerRadii: number[] = [];
  private layerRotations: number[] = [];
  private barRadius = 0;
  private containerSize = 0;

  // Renderers
  private petalRenderers: PetalRenderer[] = [];
  private colorBarRenderer!: ColorBarRenderer;
  private arcSliderRenderer: ArcSliderRenderer | null = null;
  private coreButtonRenderer!: CoreButtonRenderer;
  private backgroundRenderer!: BackgroundRenderer;

  // Timeouts
  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  private closeTimeout: ReturnType<typeof setTimeout> | null = null;

  // Bound handlers
  private boundClickOutside: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;

  constructor(
    container: HTMLElement,
    options?: Partial<BlossomColorPickerOptions>
  ) {
    this.container = container;

    const defaultValue = options?.defaultValue ?? DEFAULT_VALUE;

    this.opts = {
      colors: options?.colors ?? [],
      onChange: options?.onChange ?? (() => {}),
      onCollapse: options?.onCollapse ?? (() => {}),
      disabled: options?.disabled ?? false,
      openOnHover: options?.openOnHover ?? false,
      initialExpanded: options?.initialExpanded ?? false,
      animationDuration:
        options?.animationDuration ?? DEFAULT_ANIMATION_DURATION,
      showAlphaSlider: options?.showAlphaSlider ?? true,
      coreSize: options?.coreSize ?? 32,
      petalSize: options?.petalSize ?? 32,
      showCoreColor: options?.showCoreColor ?? false,
      sliderPosition: options?.sliderPosition,
      adaptivePositioning: options?.adaptivePositioning ?? true,
      circularBarWidth: options?.circularBarWidth ?? BAR_WIDTH,
      sliderWidth: options?.sliderWidth ?? BAR_WIDTH,
      sliderOffset: options?.sliderOffset ?? SLIDER_OFFSET,
      collapsible: options?.collapsible ?? true,
    };

    this.controlledValue = options?.value;
    this.internalValue = options?.value ?? defaultValue;
    this.isExpanded = !this.opts.collapsible || this.opts.initialExpanded;
    this.prevExpanded = this.isExpanded;
    this.effectivePosition = this.opts.sliderPosition || 'right';

    this.boundClickOutside = this.handleClickOutside.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);

    this.computeLayout();
    this.render();
    this.update();
    this.bindEvents();
    if (this.isExpanded && this.opts.collapsible) {
      document.addEventListener('mousedown', this.boundClickOutside);
    }
  }

  // --- Public API ---

  setValue(value: BlossomColorPickerValue): void {
    this.controlledValue = value;
    this.internalValue = value;
    this.update();
  }

  getValue(): BlossomColorPickerColor {
    const val = this.currentValue;
    const sliderValue = val.saturation;
    const lightness = sliderValueToLightness(sliderValue);
    const selectedPetal = this.allColors.find(c => c.h === val.hue);
    const pBaseSaturation = selectedPetal?.s ?? 70;
    const visualSaturation = getVisualSaturation(sliderValue, pBaseSaturation);

    return createColorOutput(
      val.hue,
      sliderValue,
      visualSaturation,
      pBaseSaturation,
      lightness,
      val.alpha,
      val.layer
    );
  }

  expand(): void {
    this.setExpanded(true);
  }

  collapse(): void {
    this.setExpanded(false);
  }

  toggle(): void {
    this.setExpanded(!this.isExpanded);
  }

  setOptions(options: Partial<BlossomColorPickerOptions>): void {
    let needsRerender = false;

    if (options.value !== undefined) {
      this.controlledValue = options.value;
      this.internalValue = options.value;
    }

    if (options.onChange !== undefined) this.opts.onChange = options.onChange;
    if (options.onCollapse !== undefined)
      this.opts.onCollapse = options.onCollapse;
    if (options.disabled !== undefined) this.opts.disabled = options.disabled;
    if (options.openOnHover !== undefined)
      this.opts.openOnHover = options.openOnHover;
    if (
      options.animationDuration !== undefined &&
      options.animationDuration !== this.opts.animationDuration
    ) {
      this.opts.animationDuration = options.animationDuration;
      needsRerender = true;
    }
    if (options.showCoreColor !== undefined)
      this.opts.showCoreColor = options.showCoreColor;
    if (options.sliderPosition !== undefined)
      this.opts.sliderPosition = options.sliderPosition;
    if (options.adaptivePositioning !== undefined)
      this.opts.adaptivePositioning = options.adaptivePositioning;

    if (options.initialExpanded !== undefined) {
      this.opts.initialExpanded = options.initialExpanded;
      // Note: initialExpanded is a construction-time option only.
      // We don't call setExpanded() here — the expanded state is
      // managed by user interaction after mount.
    }

    // These require re-render (DOM structure changes) — only if value actually changed
    if (
      options.colors !== undefined &&
      !colorsEqual(options.colors, this.opts.colors)
    ) {
      this.opts.colors = options.colors;
      needsRerender = true;
    }
    if (
      options.coreSize !== undefined &&
      options.coreSize !== this.opts.coreSize
    ) {
      this.opts.coreSize = options.coreSize;
      needsRerender = true;
    }
    if (
      options.petalSize !== undefined &&
      options.petalSize !== this.opts.petalSize
    ) {
      this.opts.petalSize = options.petalSize;
      needsRerender = true;
    }
    if (
      options.circularBarWidth !== undefined &&
      options.circularBarWidth !== this.opts.circularBarWidth
    ) {
      this.opts.circularBarWidth = options.circularBarWidth;
      needsRerender = true;
    }
    if (
      options.sliderWidth !== undefined &&
      options.sliderWidth !== this.opts.sliderWidth
    ) {
      this.opts.sliderWidth = options.sliderWidth;
      needsRerender = true;
    }
    if (
      options.sliderOffset !== undefined &&
      options.sliderOffset !== this.opts.sliderOffset
    ) {
      this.opts.sliderOffset = options.sliderOffset;
      needsRerender = true;
    }
    if (
      options.showAlphaSlider !== undefined &&
      options.showAlphaSlider !== this.opts.showAlphaSlider
    ) {
      this.opts.showAlphaSlider = options.showAlphaSlider;
      needsRerender = true;
    }
    if (
      options.collapsible !== undefined &&
      options.collapsible !== this.opts.collapsible
    ) {
      this.opts.collapsible = options.collapsible;
      this.isExpanded = !this.opts.collapsible || this.opts.initialExpanded;
      needsRerender = true;
    }

    if (needsRerender) {
      this.destroyInner();
      this.computeLayout();
      this.render();
    }

    this.update();
    if (this.isExpanded && this.opts.collapsible) {
      document.addEventListener('mousedown', this.boundClickOutside);
    } else {
      document.removeEventListener('mousedown', this.boundClickOutside);
    }
  }

  destroy(): void {
    this.unbindEvents();
    this.destroyInner();
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.remove();
    }
  }

  // --- Internal ---

  private get currentValue(): BlossomColorPickerValue {
    return this.controlledValue ?? this.internalValue;
  }

  private get baseSaturation(): number {
    const val = this.currentValue;
    if (val.originalSaturation !== undefined) {
      return val.originalSaturation;
    }
    const selectedColor = this.allColors.find(c => c.h === val.hue);
    return selectedColor?.s ?? 70;
  }

  private get selectedColor(): string {
    const val = this.currentValue;
    const lightness = val.lightness ?? sliderValueToLightness(val.saturation);
    const saturation = val.originalSaturation ?? this.baseSaturation;
    return hslaToString(val.hue, saturation, lightness, val.alpha);
  }

  private get coreColor(): string {
    return this.opts.showCoreColor ? this.selectedColor : '#FFFFFF';
  }

  private get currentLightness(): number {
    return (
      this.currentValue.lightness ??
      (this.currentValue.layer === 'inner' ? 85 : 65)
    );
  }

  private computeLayout(): void {
    const colors = this.opts.colors;
    const isDefaultPalette = colors.length === 0;
    this.normalizedColors = isDefaultPalette
      ? DEFAULT_COLORS
      : colors.map(parseColor);

    this.layers = organizeColorsIntoLayers(this.normalizedColors);
    if (isDefaultPalette) {
      // Match the reference bloom: yellow at 12 o'clock, then warm to cool
      // colors clockwise. Preserve the existing layout for custom palettes.
      this.layers = this.layers.map(layer =>
        layer.toSorted(
          (a, b) => clockwiseHueOrder(a.h) - clockwiseHueOrder(b.h)
        )
      );
    }
    this.allColors = this.layers.flat();

    this.layerPrefixCounts = [0];
    for (let i = 1; i < this.layers.length; i++) {
      this.layerPrefixCounts.push(
        this.layerPrefixCounts[i - 1] + this.layers[i - 1].length
      );
    }

    this.layerRadii = calculateLayerRadii(
      this.layers,
      this.opts.coreSize,
      this.opts.petalSize
    );
    this.layerRotations = isDefaultPalette
      ? this.layers.map(() => 0)
      : calculateLayerRotations(this.layers);
    this.barRadius = calculateBarRadius(
      this.layerRadii,
      this.opts.petalSize,
      this.opts.coreSize,
      BAR_GAP
    );
    this.containerSize = calculateContainerSize(
      this.barRadius,
      this.opts.circularBarWidth,
      this.opts.showAlphaSlider,
      this.opts.sliderOffset,
      this.opts.sliderWidth
    );
  }

  private render(): void {
    // Create root if not yet created
    if (!this.rootEl) {
      this.rootEl = createElement('div');
      this.rootEl.className = 'bcp-root';
      this.rootEl.setAttribute('role', 'group');
      this.rootEl.setAttribute('aria-label', 'Color picker');
      setStyles(this.rootEl, {
        width: `${this.opts.coreSize}px`,
        height: `${this.opts.coreSize}px`,
      });

      this.containerEl = createElement('div');
      this.containerEl.className = 'bcp-container';
      setStyles(this.containerEl, {
        left: '50%',
        top: '50%',
        width: `${this.containerSize}px`,
        height: `${this.containerSize}px`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      });

      this.rootEl.appendChild(this.containerEl);
      this.container.appendChild(this.rootEl);
    }

    setStyles(this.rootEl, {
      width: `${this.opts.coreSize}px`,
      height: `${this.opts.coreSize}px`,
    });

    // Trigger button for collapsible mode
    if (this.opts.collapsible && !this.triggerBtn) {
      this.triggerBtn = createElement('button', undefined, {
        type: 'button',
        'aria-label': 'Open color picker',
        'aria-expanded': String(this.isExpanded),
        tabIndex: '0',
      });
      this.triggerBtn.className = 'bcp-core bcp-trigger-btn';
      setStyles(this.triggerBtn, {
        width: `${this.opts.coreSize}px`,
        height: `${this.opts.coreSize}px`,
        backgroundColor: this.selectedColor,
      });
      this.triggerBtn.addEventListener('click', () => {
        if (this.opts.disabled) return;
        this.toggle();
      });
      this.rootEl.insertBefore(this.triggerBtn, this.containerEl);
    }

    // Background
    this.backgroundRenderer = new BackgroundRenderer(
      this.barRadius + this.opts.circularBarWidth / 2,
      this.opts.animationDuration
    );
    this.containerEl.appendChild(this.backgroundRenderer.el);

    // Color bar
    this.colorBarRenderer = new ColorBarRenderer(
      this.barRadius,
      this.opts.circularBarWidth,
      this.opts.animationDuration
    );
    this.containerEl.appendChild(this.colorBarRenderer.el);

    // Petals
    this.petalRenderers = [];
    for (let layerIdx = 0; layerIdx < this.layers.length; layerIdx++) {
      const layerColors = this.layers[layerIdx];
      const radius = this.layerRadii[layerIdx];
      const rotation = this.layerRotations[layerIdx];
      const totalPetals = layerColors.length;
      const totalLayers = this.layers.length;
      const baseZ = (totalLayers - layerIdx) * 100;

      // Find the petal index closest to 90 degrees (6 o'clock)
      // Visual Angle = (index / total) * 360 - 90 + layerRotation
      let bottomIndex = 0;
      let minDiff = Infinity;
      for (let i = 0; i < totalPetals; i++) {
        const angle = (i / totalPetals) * 360 - 90 + rotation;
        // Normalize angle to [0, 360)
        const normalizedAngle = ((angle % 360) + 360) % 360;
        // Circular difference to 90 degrees
        const diff = Math.min(
          Math.abs(normalizedAngle - 90),
          360 - Math.abs(normalizedAngle - 90)
        );
        if (diff < minDiff) {
          minDiff = diff;
          bottomIndex = i;
        }
      }

      for (let index = 0; index < layerColors.length; index++) {
        const color = layerColors[index];
        // Every layer fans open over the same window. The outermost layer
        // sweeps clockwise and each layer inside it alternates direction, so
        // the fans meet again where they started.
        const sweepsClockwise = (totalLayers - 1 - layerIdx) % 2 === 0;
        const sweepOrder = sweepsClockwise ? index : totalPetals - 1 - index;
        // The sweep starts brisk and slows towards its last petals.
        const sweepProgress = sweepOrder / Math.max(1, totalPetals - 1);
        const staggerDelay = bloomTime(
          sweepProgress ** PETAL_SWEEP_EASE * PETAL_SWEEP,
          this.opts.animationDuration
        );
        const openEasing = petalSpringEasing(
          PETAL_OVERSHOOT_FIRST +
            (PETAL_OVERSHOOT_LAST - PETAL_OVERSHOOT_FIRST) * sweepProgress
        );

        if (index === bottomIndex) {
          // Bottom petal split trick:
          // 1. Underlay (Base): Full petal, no ring, lowest Z. Fills the seam gap.
          // 2. Left Petal: Left half, has ring.
          // 3. Right Petal: Right half, has ring.
          // 4. Interaction Petal: Invisible, handles events.

          const underlayPetal = new PetalRenderer({
            hue: color.h,
            saturation: color.s,
            lightness: color.l,
            index,
            totalPetals,
            petalSize: this.opts.petalSize,
            radius,
            animationDuration: this.opts.animationDuration,
            staggerDelay,
            openEasing,
            zIndex: baseZ - 1, // Lowest
            rotationOffset: rotation,
            alpha: 1,
            pointerEvents: 'none',
            hasShadow: false,
            noRing: true, // Crucial: No ring to avoid double-rendering artifacts
          });
          this.petalRenderers.push(underlayPetal);
          this.containerEl.appendChild(underlayPetal.el);

          const leftPetal = new PetalRenderer({
            hue: color.h,
            saturation: color.s,
            lightness: color.l,
            index,
            totalPetals,
            petalSize: this.opts.petalSize,
            radius,
            animationDuration: this.opts.animationDuration,
            staggerDelay,
            openEasing,
            zIndex: getPetalZIndex(
              index,
              bottomIndex,
              totalPetals,
              layerIdx,
              totalLayers,
              true,
              false
            ),
            rotationOffset: rotation,
            alpha: 1,
            clip: 'left',
            pointerEvents: 'none',
            hasShadow: false,
          });
          this.petalRenderers.push(leftPetal);
          this.containerEl.appendChild(leftPetal.el);

          const rightPetal = new PetalRenderer({
            hue: color.h,
            saturation: color.s,
            lightness: color.l,
            index,
            totalPetals,
            petalSize: this.opts.petalSize,
            radius,
            animationDuration: this.opts.animationDuration,
            staggerDelay,
            openEasing,
            zIndex: getPetalZIndex(
              index,
              bottomIndex,
              totalPetals,
              layerIdx,
              totalLayers,
              false,
              true
            ),
            rotationOffset: rotation,
            alpha: 1,
            clip: 'right',
            pointerEvents: 'none',
            hasShadow: false,
          });
          this.petalRenderers.push(rightPetal);
          this.containerEl.appendChild(rightPetal.el);

          // Invisible interaction petal
          const interactionPetal = new PetalRenderer(
            {
              hue: color.h,
              saturation: color.s,
              lightness: color.l,
              index,
              totalPetals,
              petalSize: this.opts.petalSize,
              radius,
              animationDuration: this.opts.animationDuration,
              staggerDelay,
              openEasing,
              zIndex: baseZ + totalPetals + 20,
              rotationOffset: rotation,
              alpha: 0,
              pointerEvents: 'auto',
              hasShadow: false,
            },
            () => this.handlePetalClick(color, layerIdx),
            () => {
              this.hoveredPetal = { layer: layerIdx, index };
              // Update all visual layers
              underlayPetal.update(this.isExpanded, true, this.mousePos);
              leftPetal.update(this.isExpanded, true, this.mousePos);
              rightPetal.update(this.isExpanded, true, this.mousePos);
            },
            () => {
              this.hoveredPetal = null;
              underlayPetal.update(this.isExpanded, false, this.mousePos);
              leftPetal.update(this.isExpanded, false, this.mousePos);
              rightPetal.update(this.isExpanded, false, this.mousePos);
            }
          );
          this.petalRenderers.push(interactionPetal);
          this.containerEl.appendChild(interactionPetal.el);
        } else {
          // Normal petal
          const petal = new PetalRenderer(
            {
              hue: color.h,
              saturation: color.s,
              lightness: color.l,
              index,
              totalPetals,
              petalSize: this.opts.petalSize,
              radius,
              animationDuration: this.opts.animationDuration,
              staggerDelay,
              openEasing,
              zIndex: getPetalZIndex(
                index,
                bottomIndex,
                totalPetals,
                layerIdx,
                totalLayers
              ),
              rotationOffset: rotation,
              alpha: 1,
              pointerEvents: 'auto',
              hasShadow: false,
            },
            () => this.handlePetalClick(color, layerIdx),
            () => {
              this.hoveredPetal = { layer: layerIdx, index };
            },
            () => {
              this.hoveredPetal = null;
            }
          );
          this.petalRenderers.push(petal);
          this.containerEl.appendChild(petal.el);
        }
      }
    }

    // Arc slider
    if (this.opts.showAlphaSlider) {
      this.arcSliderRenderer = new ArcSliderRenderer(
        this.barRadius,
        this.opts.sliderWidth,
        this.opts.sliderOffset,
        this.opts.animationDuration,
        value => this.handleSliderChange(value),
        this.effectivePosition
      );
      this.containerEl.appendChild(this.arcSliderRenderer.el);
    }

    // Core button
    this.coreButtonRenderer = new CoreButtonRenderer(
      this.opts.coreSize,
      this.opts.animationDuration,
      () => this.handleCoreClick()
    );
    this.containerEl.appendChild(this.coreButtonRenderer.el);
  }

  private update(): void {
    const val = this.currentValue;
    const t = (ms: number) => bloomTime(ms, this.opts.animationDuration);

    // Adaptive positioning — compute only on expand transition, not during every update.
    // Using rootEl (stable, small) instead of containerEl (animating, shifting) prevents jitter.
    if (this.isExpanded && !this.prevExpanded && this.rootEl) {
      const rootRect = this.rootEl.getBoundingClientRect();
      const result = computeAdaptivePosition({
        elementRect: rootRect,
        containerSize: this.containerSize,
        currentShiftOffset: { x: 0, y: 0 },
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        sliderPosition: this.opts.sliderPosition,
        adaptivePositioning: this.opts.adaptivePositioning,
        circularBarWidth: this.opts.circularBarWidth,
        sliderOffset: this.opts.sliderOffset,
      });
      this.shiftOffset = result.shiftOffset;
      this.effectivePosition = result.effectivePosition;
    } else if (!this.isExpanded) {
      this.shiftOffset = { x: 0, y: 0 };
      this.effectivePosition = this.opts.sliderPosition || 'right';
    }

    // The floating layer stays mounted so each part can follow its own timing.
    // As a unit it only swells open / folds shut (individual `scale`, anchored
    // on the trigger) and slides to its adaptive position (`transform`).
    const showsBloom = this.isExpanded || !this.opts.collapsible;
    const transitionStr = this.isFirstRender
      ? 'none'
      : this.isExpanded
        ? `scale ${t(BLOOM_SCALE_DURATION)}ms ${BLOOM_OPEN_EASING} ${t(BLOOM_SCALE_DELAY)}ms, transform ${t(BLOOM_SCALE_DELAY + BLOOM_SCALE_DURATION)}ms ${BLOOM_OPEN_EASING}`
        : `scale ${t(COLLAPSE_DURATION)}ms ${BLOOM_CLOSE_EASING} ${t(COLLAPSE_DELAY)}ms, transform ${t(COLLAPSE_DURATION)}ms ${BLOOM_CLOSE_EASING} ${t(COLLAPSE_DELAY)}ms`;

    setStyles(this.containerEl, {
      width: `${this.containerSize}px`,
      height: `${this.containerSize}px`,
      transformOrigin: '0 0',
      transform: `translate(calc(-50% + ${this.shiftOffset.x}px), calc(-50% + ${this.shiftOffset.y}px))`,
      scale: showsBloom ? '1' : String(BLOOM_COLLAPSED_SCALE),
      opacity: '1',
      pointerEvents: showsBloom ? 'auto' : 'none',
      transition: transitionStr,
      zIndex: '50',
    });

    // Keeps the stylesheet's hover / press transitions alive next to the inline ones.
    const triggerHover =
      'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease';

    if (this.opts.collapsible) {
      this.containerEl.inert = !this.isExpanded;
      this.containerEl.setAttribute('aria-hidden', String(!this.isExpanded));

      if (this.triggerBtn) {
        this.triggerBtn.disabled = this.opts.disabled;
        this.triggerBtn.tabIndex = this.isExpanded ? -1 : 0;
        this.triggerBtn.setAttribute('aria-expanded', String(this.isExpanded));
        this.triggerBtn.setAttribute('aria-hidden', String(this.isExpanded));
        setStyles(this.triggerBtn, {
          backgroundColor: this.selectedColor,
          opacity: this.isExpanded ? '0' : '1',
          // Shrinks only once it is hidden, then pops back in on close.
          scale: this.isExpanded ? String(TRIGGER_COLLAPSED_SCALE) : '1',
          pointerEvents: this.isExpanded ? 'none' : 'auto',
          transition: `${triggerHover}, ${
            this.isFirstRender
              ? 'opacity 0ms, scale 0ms'
              : this.isExpanded
                ? `opacity ${t(TRIGGER_FADE_DURATION)}ms ease, scale 0ms linear ${t(TRIGGER_FADE_DURATION)}ms`
                : `opacity ${t(TRIGGER_FADE_DURATION)}ms ease ${t(TRIGGER_POP_DELAY)}ms, scale ${t(TRIGGER_POP_DURATION)}ms ${TRIGGER_POP_EASING} ${t(TRIGGER_POP_DELAY)}ms`
          }`,
        });
      }
    } else {
      this.containerEl.inert = false;
      this.containerEl.removeAttribute('aria-hidden');
    }

    this.isFirstRender = false;

    // Background
    this.backgroundRenderer.update(
      val.hue,
      val.saturation,
      this.currentLightness,
      this.isExpanded
    );

    // Color bar
    this.colorBarRenderer.update(
      val.hue,
      getVisualSaturation(val.saturation, this.baseSaturation),
      this.currentLightness,
      val.alpha,
      this.isExpanded
    );

    // Petals
    for (const petal of this.petalRenderers) {
      petal.update(this.isExpanded, undefined, this.mousePos);
    }

    // Arc slider
    if (this.arcSliderRenderer) {
      this.arcSliderRenderer.update(
        val.saturation,
        val.hue,
        this.baseSaturation,
        this.isExpanded,
        this.effectivePosition
      );
    }

    // Core button
    this.coreButtonRenderer.update(
      this.coreColor,
      this.isExpanded,
      this.isHovering,
      this.opts.disabled
    );

    // Handle collapse callback
    if (this.prevExpanded && !this.isExpanded) {
      this.fireOnCollapse();
    }
    this.prevExpanded = this.isExpanded;
  }

  private bindEvents(): void {
    this.rootEl.addEventListener('mouseenter', () => {
      this.handleMouseEnter();
    });
    this.rootEl.addEventListener('mouseleave', () => {
      this.handleMouseLeave();
    });
    this.containerEl.addEventListener('mousemove', this.boundMouseMove);
  }

  private unbindEvents(): void {
    document.removeEventListener('mousedown', this.boundClickOutside);
    this.containerEl.removeEventListener('mousemove', this.boundMouseMove);
  }

  private handleMouseMove(e: MouseEvent): void {
    const rect = this.containerEl.getBoundingClientRect();
    this.mousePos = {
      x: e.clientX - (rect.left + rect.width / 2),
      y: e.clientY - (rect.top + rect.height / 2),
    };

    if (this.isExpanded && !this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.updateInteractive();
        this.rafId = null;
      });
    }
  }

  private updateInteractive(): void {
    const val = this.currentValue;
    // Only update things that respond to mouse position
    for (const petal of this.petalRenderers) {
      petal.update(this.isExpanded, undefined, this.mousePos);
    }

    this.backgroundRenderer.update(
      val.hue,
      val.saturation,
      this.currentLightness,
      this.isExpanded
    );

    // Sync other renderers just in case they were updated during the interactive frame
    this.colorBarRenderer.update(
      val.hue,
      getVisualSaturation(val.saturation, this.baseSaturation),
      this.currentLightness,
      val.alpha,
      this.isExpanded
    );

    if (this.arcSliderRenderer) {
      this.arcSliderRenderer.update(
        val.saturation,
        val.hue,
        this.baseSaturation,
        this.isExpanded,
        this.effectivePosition
      );
    }

    this.coreButtonRenderer.update(
      this.coreColor,
      this.isExpanded,
      this.isHovering,
      this.opts.disabled
    );

    if (this.triggerBtn) {
      this.triggerBtn.disabled = this.opts.disabled;
      this.triggerBtn.setAttribute('aria-expanded', String(this.isExpanded));
      setStyles(this.triggerBtn, {
        backgroundColor: this.selectedColor,
      });
    }
  }

  private destroyInner(): void {
    for (const petal of this.petalRenderers) {
      petal.destroy();
    }
    this.petalRenderers = [];

    this.colorBarRenderer?.destroy();
    this.arcSliderRenderer?.destroy();
    this.arcSliderRenderer = null;
    this.coreButtonRenderer?.destroy();
    this.backgroundRenderer?.destroy();

    if (this.triggerBtn) {
      this.triggerBtn.remove();
      this.triggerBtn = null;
    }
  }

  private setExpanded(expanded: boolean): void {
    const focusWasOnTrigger = document.activeElement === this.triggerBtn;
    const focusWasInPicker = this.containerEl.contains(document.activeElement);

    if (!this.opts.collapsible) {
      this.isExpanded = true;
    } else {
      this.isExpanded = expanded;
    }

    if (this.isExpanded) {
      document.addEventListener('mousedown', this.boundClickOutside);
    } else {
      document.removeEventListener('mousedown', this.boundClickOutside);
    }

    this.update();

    if (this.isExpanded && focusWasOnTrigger) {
      this.coreButtonRenderer.el.focus();
    } else if (!this.isExpanded && focusWasInPicker) {
      this.triggerBtn?.focus();
    }
  }

  private handleClickOutside(e: MouseEvent): void {
    if (!this.opts.collapsible) return;
    const target = e.target as Node;
    if (this.triggerBtn && this.triggerBtn.contains(target)) {
      return;
    }
    if (this.containerEl && !this.containerEl.contains(target)) {
      this.setExpanded(false);
    }
  }

  private handleMouseEnter(): void {
    if (this.opts.disabled || !this.opts.openOnHover || !this.opts.collapsible)
      return;

    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }

    this.isHovering = true;
    this.hoverTimeout = setTimeout(() => {
      this.setExpanded(true);
    }, HOVER_DELAY);
  }

  private handleMouseLeave(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }

    this.isHovering = false;

    if (this.opts.openOnHover && this.opts.collapsible) {
      this.closeTimeout = setTimeout(() => {
        this.setExpanded(false);
      }, 200);
    }
  }

  private handleCoreClick(): void {
    if (this.opts.disabled || !this.opts.collapsible) return;
    this.setExpanded(!this.isExpanded);
  }

  private handlePetalClick(
    color: { h: number; s: number; l: number },
    layerIdx: number
  ): void {
    const sliderValue = lightnessToSliderValue(color.l);
    const layerStr: 'inner' | 'outer' = layerIdx === 0 ? 'inner' : 'outer';
    const visualSaturation = color.s;

    const newValue: BlossomColorPickerValue = {
      hue: color.h,
      saturation: sliderValue,
      lightness: color.l,
      originalSaturation: color.s,
      layer: layerStr,
      alpha: this.currentValue.alpha, // Keep current alpha
    };

    if (this.controlledValue === undefined) {
      this.internalValue = newValue;
    }

    this.opts.onChange(
      createColorOutput(
        color.h,
        sliderValue,
        visualSaturation,
        color.s,
        color.l,
        this.currentValue.alpha,
        layerStr
      )
    );

    this.update();
  }

  private handleSliderChange(sliderValue: number): void {
    const lightness = sliderValueToLightness(sliderValue);
    const visualSaturation = getVisualSaturation(
      sliderValue,
      this.baseSaturation
    );

    this.internalValue = {
      ...this.currentValue,
      saturation: sliderValue,
      lightness,
      originalSaturation: this.baseSaturation,
    };

    this.opts.onChange(
      createColorOutput(
        this.currentValue.hue,
        sliderValue,
        visualSaturation,
        this.baseSaturation,
        lightness,
        this.currentValue.alpha,
        this.currentValue.layer
      )
    );

    this.update();
  }

  private fireOnCollapse(): void {
    const val = this.currentValue;
    const sliderValue = val.saturation;
    const lightness = sliderValueToLightness(sliderValue);
    const selectedPetal = this.allColors.find(c => c.h === val.hue);
    const pBaseSaturation = selectedPetal?.s ?? 70;
    const visualSaturation = getVisualSaturation(sliderValue, pBaseSaturation);

    this.opts.onCollapse(
      createColorOutput(
        val.hue,
        sliderValue,
        visualSaturation,
        pBaseSaturation,
        lightness,
        val.alpha,
        val.layer
      )
    );
  }
}
