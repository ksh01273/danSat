/**
 * @file Dangam Corp. Tailwind CSS 프리셋
 * @description 모든 단감 서비스에 공통 적용되는 Tailwind 설정
 *
 * 사용법 (각 프로젝트 tailwind.config.js):
 *
 *   import dangamPreset from 'dangam-tailwind'
 *
 *   export default {
 *     presets: [dangamPreset],
 *     content: ['./index.html', './src/**\/*.{vue,js,ts,jsx,tsx}'],
 *     theme: {
 *       extend: {
 *         // 프로젝트 고유 확장 (예: 프로젝트 컬러)
 *         colors: {
 *           fishing: { primary: '...', dark: '...' },
 *         },
 *       },
 *     },
 *   }
 */

import dangamPlugin from './plugin.js'

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      /* ── 색상 ── */
      colors: {
        dan: {
          brand:        'var(--dan-brand)',
          'brand-light': 'var(--dan-brand-light)',
          'brand-dark':  'var(--dan-brand-dark)',
          'brand-alpha': 'var(--dan-brand-alpha)',
          accent:        'var(--dan-accent)',
          'accent-light': 'var(--dan-accent-light)',
          'accent-dark':  'var(--dan-accent-dark)',
          'accent-alpha': 'var(--dan-accent-alpha)',
          success: 'var(--dan-success)',
          warning: 'var(--dan-warning)',
          error:   'var(--dan-error)',
          info:    'var(--dan-info)',
          gray: {
            50:  'var(--dan-gray-50)',
            100: 'var(--dan-gray-100)',
            200: 'var(--dan-gray-200)',
            300: 'var(--dan-gray-300)',
            400: 'var(--dan-gray-400)',
            500: 'var(--dan-gray-500)',
            600: 'var(--dan-gray-600)',
            700: 'var(--dan-gray-700)',
            800: 'var(--dan-gray-800)',
            900: 'var(--dan-gray-900)',
            950: 'var(--dan-gray-950)',
          },
        },
      },

      /* ── 폰트 ── */
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },

      /* ── 폰트 사이즈 ── */
      fontSize: {
        'xs':   ['var(--dan-text-xs)',   { lineHeight: '1.6' }],
        'sm':   ['var(--dan-text-sm)',   { lineHeight: '1.6' }],
        'base': ['var(--dan-text-base)', { lineHeight: '1.6' }],
        'md':   ['var(--dan-text-md)',   { lineHeight: '1.5' }],
        'lg':   ['var(--dan-text-lg)',   { lineHeight: '1.5' }],
        'xl':   ['var(--dan-text-xl)',   { lineHeight: '1.4' }],
        '2xl':  ['var(--dan-text-2xl)',  { lineHeight: '1.3' }],
        '3xl':  ['var(--dan-text-3xl)',  { lineHeight: '1.2' }],
      },

      /* ── 스페이싱 ── */
      spacing: {
        'dan-xs':  'var(--dan-space-xs)',
        'dan-sm':  'var(--dan-space-sm)',
        'dan-md':  'var(--dan-space-md)',
        'dan-lg':  'var(--dan-space-lg)',
        'dan-xl':  'var(--dan-space-xl)',
        'dan-2xl': 'var(--dan-space-2xl)',
      },

      /* ── 라운딩 ── */
      borderRadius: {
        'dan-sm':   'var(--dan-radius-sm)',
        'dan-md':   'var(--dan-radius-md)',
        'dan-lg':   'var(--dan-radius-lg)',
        'dan-xl':   'var(--dan-radius-xl)',
        'dan-full': 'var(--dan-radius-full)',
      },

      /* ── 그림자 ── */
      boxShadow: {
        'dan-sm': 'var(--dan-shadow-sm)',
        'dan-md': 'var(--dan-shadow-md)',
        'dan-lg': 'var(--dan-shadow-lg)',
        'dan-xl': 'var(--dan-shadow-xl)',
      },

      /* ── Z-index ── */
      zIndex: {
        'base':    'var(--dan-z-base)',
        'above':   'var(--dan-z-above)',
        'sidebar': 'var(--dan-z-sidebar)',
        'header':  'var(--dan-z-header)',
        'overlay': 'var(--dan-z-overlay)',
        'modal':   'var(--dan-z-modal)',
        'toast':   'var(--dan-z-toast)',
      },

      /* ── 트랜지션 ── */
      transitionTimingFunction: {
        dan: 'var(--dan-ease)',
      },
      transitionDuration: {
        dan: 'var(--dan-duration)',
      },
    },
  },

  plugins: [dangamPlugin],
}
