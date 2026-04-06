import dangamPreset from './dangam-tailwind/src/preset.js'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [dangamPreset],
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
