# @dayflow/blossom-color-picker-svelte

Svelte wrapper for [Blossom Color Picker](https://github.com/dayflow-js/BlossomColorPicker).

## Installation

```bash
npm install @dayflow/blossom-color-picker-svelte @dayflow/blossom-color-picker
```

## Usage

```svelte
<script>
  import { BlossomColorPicker } from '@dayflow/blossom-color-picker-svelte';
  import '@dayflow/blossom-color-picker/styles.css';

  let color = {
    hue: 330,
    saturation: 70,
    alpha: 100,
    layer: 'outer',
  };

  function handleChange(event) {
    color = event.detail;
    console.log('Selected color:', color.hex);
  }
</script>

<BlossomColorPicker
  value={color}
  on:change={handleChange}
/>
```

## Props

Supports all props from the core `BlossomColorPickerOptions`.

| Prop                  | Type                                     | Default     |
| :-------------------- | :--------------------------------------- | :---------- |
| `value`               | `BlossomColorPickerValue`                | -           |
| `defaultValue`        | `BlossomColorPickerValue`                | -           |
| `colors`              | `ColorInput[]`                           | -           |
| `disabled`            | `boolean`                                | `false`     |
| `openOnHover`         | `boolean`                                | `false`     |
| `initialExpanded`     | `boolean`                                | `false`     |
| `animationDuration`   | `number`                                 | `280`       | Base timing of the blooming animation in ms; every phase scales with it (at the default the bloom settles in about 550 ms). |
| `showAlphaSlider`     | `boolean`                                | `true`      |
| `coreSize`            | `number`                                 | `32`        |
| `petalSize`           | `number`                                 | `32`        |
| `showCoreColor`       | `boolean`                                | `false`     |
| `sliderPosition`      | `'top' \| 'bottom' \| 'left' \| 'right'` | `undefined` |
| `adaptivePositioning` | `boolean`                                | `true`      |
| `class`               | `string`                                 | `""`        |

With the default `showCoreColor={false}`, the core is white while expanded.

## Events

| Event      | Detail                    | Description                      |
| :--------- | :------------------------ | :------------------------------- |
| `change`   | `BlossomColorPickerColor` | Fired when the color changes.    |
| `collapse` | `BlossomColorPickerColor` | Fired when the picker collapses. |

## License

MIT
