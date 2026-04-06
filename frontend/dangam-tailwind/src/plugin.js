/**
 * @file Dangam Tailwind Plugin
 * @description dangam-ds.css의 유틸리티 클래스와 반응형 컴포넌트를
 *              Tailwind 플러그인으로 변환. sm:/md:/lg: 프리픽스 자동 지원
 */

import plugin from 'tailwindcss/plugin'

export default plugin(function ({ addBase, addUtilities, addComponents, matchUtilities, theme }) {

  /* ============================================================
     1. 기본 리셋 & 글로벌 스타일 (dangam-ds.css 섹션 2 대체)
     ============================================================ */
  addBase({
    '*, *::before, *::after': {
      margin: '0',
      padding: '0',
      boxSizing: 'border-box',
    },
    'html': {
      fontFamily: 'var(--dan-font)',
      fontSize: '16px',
      lineHeight: '1.6',
      '-webkit-font-smoothing': 'antialiased',
      '-moz-osx-font-smoothing': 'grayscale',
      textRendering: 'optimizeLegibility',
      scrollBehavior: 'smooth',
      '-webkit-text-size-adjust': '100%',
    },
    'html, body, #app, #root': {
      width: '100%',
      height: '100%',
    },
    'body': {
      fontSize: 'var(--dan-text-base)',
      minWidth: '320px',
    },
    'img, svg, video': {
      display: 'block',
      maxWidth: '100%',
    },
    'a': {
      color: 'inherit',
      textDecoration: 'none',
    },
    'button, input, select, textarea': {
      font: 'inherit',
      color: 'inherit',
      border: 'none',
      outline: 'none',
      background: 'none',
    },
    'button': {
      cursor: 'pointer',
    },
    'ul, ol': {
      listStyle: 'none',
    },
    'table': {
      borderCollapse: 'collapse',
      borderSpacing: '0',
    },
    /* 스크롤바 */
    '::-webkit-scrollbar': {
      width: '6px',
      height: '6px',
    },
    '::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '::-webkit-scrollbar-thumb': {
      background: 'var(--dan-gray-400)',
      borderRadius: 'var(--dan-radius-full)',
    },
    '::-webkit-scrollbar-thumb:hover': {
      background: 'var(--dan-gray-500)',
    },
    '*': {
      scrollbarWidth: 'thin',
      scrollbarColor: 'var(--dan-gray-400) transparent',
    },
  })


  /* ============================================================
     2. 유틸리티 클래스 (sm:/md:/lg: 반응형 자동 지원)
     ============================================================ */
  addUtilities({
    /* 텍스트 말줄임 */
    '.dan-truncate': {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    '.dan-line-clamp-2': {
      display: '-webkit-box',
      '-webkit-line-clamp': '2',
      '-webkit-box-orient': 'vertical',
      overflow: 'hidden',
    },
    '.dan-line-clamp-3': {
      display: '-webkit-box',
      '-webkit-line-clamp': '3',
      '-webkit-box-orient': 'vertical',
      overflow: 'hidden',
    },

    /* 글래스모피즘 */
    '.dan-glass': {
      backdropFilter: 'blur(12px) saturate(180%)',
      '-webkit-backdrop-filter': 'blur(12px) saturate(180%)',
    },
    '.dan-glass-light': {
      backdropFilter: 'blur(8px) saturate(150%)',
      '-webkit-backdrop-filter': 'blur(8px) saturate(150%)',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
    },
    '.dan-glass-dark': {
      backdropFilter: 'blur(12px) saturate(180%)',
      '-webkit-backdrop-filter': 'blur(12px) saturate(180%)',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },

    /* 포커스 링 */
    '.dan-focus-ring': {
      '&:focus-visible': {
        outline: '2px solid var(--dan-accent)',
        outlineOffset: '2px',
      },
    },

    /* 스크롤 컨테이너 */
    '.dan-scroll': {
      overflowY: 'auto',
      overscrollBehavior: 'contain',
    },
    '.dan-scroll-x': {
      overflowX: 'auto',
      overscrollBehavior: 'contain',
    },

    /* 터치 최적화 */
    '.dan-touch': {
      touchAction: 'manipulation',
      '-webkit-tap-highlight-color': 'transparent',
    },
    '.dan-touch-target': {
      minWidth: '44px',
      minHeight: '44px',
    },

    /* iOS Safe Area */
    '.dan-safe-top': {
      paddingTop: 'env(safe-area-inset-top, 0px)',
    },
    '.dan-safe-bottom': {
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    },
    '.dan-safe-left': {
      paddingLeft: 'env(safe-area-inset-left, 0px)',
    },
    '.dan-safe-right': {
      paddingRight: 'env(safe-area-inset-right, 0px)',
    },
    '.dan-safe-x': {
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
    },
    '.dan-safe-y': {
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    },

    /* GPU 가속 */
    '.dan-gpu': {
      '-webkit-transform': 'translateZ(0)',
      '-webkit-backface-visibility': 'hidden',
      willChange: 'transform',
    },
  })


  /* ============================================================
     3. 컴포넌트 클래스 (재사용 UI 패턴)
     ============================================================ */
  addComponents({
    /* 배지 */
    '.dan-badge': {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      fontSize: 'var(--dan-text-xs)',
      fontWeight: '600',
      borderRadius: 'var(--dan-radius-full)',
      lineHeight: '1.6',
    },
    '.dan-badge-success': {
      background: 'rgba(16, 185, 129, 0.15)',
      color: 'var(--dan-success)',
    },
    '.dan-badge-warning': {
      background: 'rgba(245, 158, 11, 0.15)',
      color: 'var(--dan-warning)',
    },
    '.dan-badge-error': {
      background: 'rgba(239, 68, 68, 0.15)',
      color: 'var(--dan-error)',
    },
    '.dan-badge-info': {
      background: 'rgba(59, 130, 246, 0.15)',
      color: 'var(--dan-info)',
    },

    /* 카드 */
    '.dan-card': {
      borderRadius: 'var(--dan-radius-md)',
      transition: 'box-shadow var(--dan-transition), transform var(--dan-transition)',
      '&:hover': {
        boxShadow: 'var(--dan-shadow-lg)',
      },
    },
    '.dan-card-interactive': {
      borderRadius: 'var(--dan-radius-md)',
      transition: 'box-shadow var(--dan-transition), transform var(--dan-transition)',
      cursor: 'pointer',
      '&:hover': {
        boxShadow: 'var(--dan-shadow-lg)',
        transform: 'translateY(-2px)',
      },
      '&:active': {
        transform: 'translateY(0)',
      },
    },

    /* 로고 */
    '.dan-logo': {
      fontWeight: '800',
      letterSpacing: '-0.5px',
    },
    '.dan-logo-accent': {
      color: 'var(--dan-brand)',
    },

    /* 버튼 기본형 */
    '.dan-btn': {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--dan-space-sm)',
      padding: '0.5rem 1rem',
      fontSize: 'var(--dan-text-sm)',
      fontWeight: '500',
      borderRadius: 'var(--dan-radius-md)',
      transition: 'all var(--dan-transition)',
      minHeight: '36px',
      touchAction: 'manipulation',
      '&:active': {
        transform: 'scale(0.97)',
      },
    },
    '.dan-btn-primary': {
      backgroundColor: 'var(--dan-accent)',
      color: '#ffffff',
      '&:hover': {
        backgroundColor: 'var(--dan-accent-dark)',
      },
    },
    '.dan-btn-secondary': {
      backgroundColor: 'var(--dan-gray-100)',
      color: 'var(--dan-gray-700)',
      '&:hover': {
        backgroundColor: 'var(--dan-gray-200)',
      },
    },
    '.dan-btn-ghost': {
      backgroundColor: 'transparent',
      color: 'var(--dan-gray-600)',
      '&:hover': {
        backgroundColor: 'var(--dan-gray-100)',
      },
    },

    /* 입력 필드 */
    '.dan-input': {
      width: '100%',
      padding: '0.5rem 0.75rem',
      fontSize: 'var(--dan-text-sm)',
      border: '1px solid var(--dan-gray-300)',
      borderRadius: 'var(--dan-radius-md)',
      backgroundColor: '#ffffff',
      transition: 'border-color var(--dan-transition), box-shadow var(--dan-transition)',
      '&:focus': {
        borderColor: 'var(--dan-accent)',
        boxShadow: '0 0 0 3px var(--dan-accent-alpha)',
      },
      '&::placeholder': {
        color: 'var(--dan-gray-400)',
      },
    },

    /* 반응형 컨테이너 */
    '.dan-container': {
      width: '100%',
      maxWidth: '1280px',
      marginLeft: 'auto',
      marginRight: 'auto',
      paddingLeft: 'var(--dan-space-md)',
      paddingRight: 'var(--dan-space-md)',
      '@media (min-width: 640px)': {
        paddingLeft: 'var(--dan-space-lg)',
        paddingRight: 'var(--dan-space-lg)',
      },
    },
    '.dan-container-narrow': {
      width: '100%',
      maxWidth: '960px',
      marginLeft: 'auto',
      marginRight: 'auto',
      paddingLeft: 'var(--dan-space-md)',
      paddingRight: 'var(--dan-space-md)',
    },

    /* 반응형 레이아웃: 모바일 스택 → 데스크톱 사이드 */
    '.dan-layout-sidebar': {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      '@media (min-width: 768px)': {
        flexDirection: 'row',
      },
    },
    '.dan-layout-sidebar > .dan-sidebar': {
      width: '100%',
      maxHeight: '45vh',
      overflowY: 'auto',
      flexShrink: '0',
      '@media (min-width: 768px)': {
        width: '360px',
        maxHeight: 'none',
        height: '100%',
      },
    },
    '.dan-layout-sidebar > .dan-main': {
      flex: '1',
      minWidth: '0',
      position: 'relative',
    },

    /* 반응형 내비게이션: 모바일 바텀탭 + 데스크톱 헤더 */
    '.dan-nav-header': {
      display: 'none',
      '@media (min-width: 768px)': {
        display: 'flex',
      },
    },
    '.dan-nav-bottom': {
      display: 'flex',
      '@media (min-width: 768px)': {
        display: 'none',
      },
    },
  })


  /* ============================================================
     4. 모바일 최적화 미디어쿼리 (dangam-ds.css 섹션 4 대체)
     ============================================================ */
  addBase({
    '@media (max-width: 767px)': {
      'button, a, [role="button"]': {
        minHeight: '44px',
        minWidth: '44px',
      },
      'a, button': {
        '-webkit-tap-highlight-color': 'var(--dan-accent-alpha)',
        touchAction: 'manipulation',
      },
      '::-webkit-scrollbar': {
        width: '3px',
        height: '3px',
      },
    },
  })

})
