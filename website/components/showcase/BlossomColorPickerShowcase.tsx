'use client';

import { organizeColorsIntoLayers } from '@dayflow/blossom-color-picker';
import {
  BlossomColorPicker,
  ChromePicker,
  type BlossomColorPickerValue,
} from '@dayflow/blossom-color-picker-react';
import React, { useMemo, useState } from 'react';

const MAX_COLOR_COUNT = 42;

// Lightness / saturation of each ring, innermost first.
const RING_TONES: Record<number, { s: number; l: number }[]> = {
  1: [{ s: 76, l: 66 }],
  2: [
    { s: 88, l: 87 },
    { s: 74, l: 64 },
  ],
  3: [
    { s: 88, l: 90 },
    { s: 80, l: 77 },
    { s: 72, l: 63 },
  ],
  4: [
    { s: 90, l: 92 },
    { s: 85, l: 82 },
    { s: 78, l: 72 },
    { s: 70, l: 61 },
  ],
};

// Builds a colour wheel for the picker's own ring layout: hue follows the
// angle on every ring and each ring keeps a single tone, so the bloom reads
// as one continuous wheel that gets lighter towards the centre.
function buildWheelPalette(count: number) {
  // Ask the picker how it will split `count` colours into rings.
  const ringSizes = organizeColorsIntoLayers(
    Array.from({ length: count }, (_, i) => ({ h: 0, s: 0, l: count - i }))
  ).map(ring => ring.length);
  const tones = RING_TONES[ringSizes.length];

  return ringSizes.flatMap((size, ringIdx) => {
    const step = 360 / size;
    // Rings after the first are rotated by half a petal of the ring inside.
    const rotation = ringIdx === 0 ? 0 : 180 / ringSizes[ringIdx - 1];
    return Array.from({ length: size }, (_, i) => ({
      h: Math.round(i * step + (rotation % step)) % 360,
      ...tones[ringIdx],
    }));
  });
}

export function BlossomColorPickerShowcase() {
  const [basicColor, setBasicColor] = useState<BlossomColorPickerValue>({
    hue: 92,
    saturation: 45,
    lightness: 69,
    alpha: 100,
    layer: 'outer',
  });

  const [chromeColor, setChromeColor] = useState<BlossomColorPickerValue>({
    hue: 210,
    saturation: 50,
    lightness: 50,
    alpha: 80,
    layer: 'outer',
  });

  const [activePos, setActivePos] = useState<
    'top' | 'bottom' | 'left' | 'right'
  >('left');
  const [colorCount, setColorCount] = useState(MAX_COLOR_COUNT);
  const [isPickerExpanded, setIsPickerExpanded] = useState(false);
  const [multiLayerColor, setMultiLayerColor] =
    useState<BlossomColorPickerValue>({
      hue: 330,
      saturation: 10,
      lightness: 92,
      alpha: 100,
      layer: 'outer',
    });

  const dynamicPalette = useMemo(
    () => buildWheelPalette(colorCount),
    [colorCount]
  );

  return (
    <div className='grid w-full max-w-5xl grid-cols-1 items-start gap-8 py-8 lg:grid-cols-2'>
      <div className='flex flex-col gap-8'>
        {/* Basic Bloom */}
        <div className='rounded-2xl border border-gray-100 bg-white p-6 shadow-xl transition-all dark:border-slate-800 dark:bg-slate-900 dark:shadow-2xl/20'>
          <div className='flex items-center justify-between'>
            <div className='flex flex-col'>
              <span className='text-lg font-semibold tracking-tight text-gray-800 dark:text-gray-100'>
                Basic
              </span>
            </div>
            <BlossomColorPicker
              value={basicColor}
              onChange={newColor => setBasicColor(newColor)}
              coreSize={44}
              petalSize={44}
              sliderWidth={24}
              showCoreColor
            />
          </div>
        </div>

        {/* Multi-Layer Example */}
        <div className='rounded-2xl border border-gray-100 bg-white p-8 shadow-xl transition-all dark:border-slate-800 dark:bg-slate-900 dark:shadow-2xl/20'>
          <div className='flex flex-col'>
            <div className='mb-24 flex items-center justify-between'>
              <div className='flex flex-col'>
                <span className='text-lg font-semibold tracking-tight text-gray-800 dark:text-gray-100'>
                  Multi-Layer
                </span>
                <span className='mt-1 text-xs text-gray-400 dark:text-gray-500'>
                  {colorCount} colors auto-distributed
                </span>
                <span className='text-xs text-gray-400 dark:text-gray-500'>
                  Adaptive Positioning on mobile
                </span>
              </div>

              <div className='relative'>
                <BlossomColorPicker
                  colors={dynamicPalette}
                  value={multiLayerColor}
                  onChange={newColor => setMultiLayerColor(newColor)}
                  sliderPosition={activePos}
                  initialExpanded={isPickerExpanded}
                  coreSize={48}
                  petalSize={36}
                  sliderWidth={18}
                  showCoreColor
                  onCollapse={() => setIsPickerExpanded(false)}
                />
              </div>
            </div>

            <div className='space-y-4 border-t border-gray-50 pt-4 dark:border-slate-800'>
              {/* Color Count Control */}
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                  Color Count
                </span>
                <div className='flex items-center rounded-lg bg-gray-100 p-1 dark:bg-slate-800'>
                  <button
                    onClick={() => {
                      setColorCount(prev => Math.max(1, prev - 1));
                      setIsPickerExpanded(true);
                    }}
                    className='px-3 py-1 text-lg font-bold text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400'
                  >
                    -
                  </button>
                  <input
                    type='number'
                    value={colorCount}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) {
                        setColorCount(
                          Math.max(1, Math.min(MAX_COLOR_COUNT, val))
                        );
                        setIsPickerExpanded(true);
                      }
                    }}
                    className='w-12 appearance-none bg-transparent text-center font-mono text-sm focus:outline-none dark:text-gray-200'
                  />
                  <button
                    onClick={() => {
                      setColorCount(prev =>
                        Math.min(MAX_COLOR_COUNT, prev + 1)
                      );
                      setIsPickerExpanded(true);
                    }}
                    className='px-3 py-1 text-lg font-bold text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400'
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Position Tabs */}
              <div className='flex rounded-xl bg-gray-100 p-1 dark:bg-slate-800'>
                {(['top', 'bottom', 'left', 'right'] as const).map(pos => (
                  <button
                    key={pos}
                    onClick={() => {
                      setActivePos(pos);
                      setIsPickerExpanded(true);
                    }}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                      activePos === pos
                        ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {pos.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='flex flex-col gap-8'>
        {/* ChromePicker Example */}
        <div className='flex h-full flex-col rounded-2xl border border-gray-100 bg-white px-8 py-10 shadow-xl transition-all dark:border-slate-800 dark:bg-slate-900 dark:shadow-2xl/20'>
          <span className='mb-8 text-lg font-semibold tracking-tight text-gray-800 dark:text-gray-100'>
            Chrome Picker
          </span>
          <div className='flex flex-1 items-center justify-center'>
            <ChromePicker
              value={chromeColor}
              onChange={newColor => setChromeColor(newColor)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
