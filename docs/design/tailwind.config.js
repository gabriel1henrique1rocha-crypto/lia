/* ============================================================
   LIA — Design System · Config equivalente do Tailwind
   ------------------------------------------------------------
   Mesmos valores de lia-tokens.css, em theme.extend. Use junto
   com (ou no lugar de) as variáveis CSS.

   Razões de contraste (WCAG 2.1) anotadas por par texto/fundo.
   Salvo indicação, medidas sobre paper-50 (#fbf8f1), o fundo da
   página; sobre cartões brancos (paper-0) o contraste é igual
   ou maior. Texto normal AA >= 4.5:1 · AAA >= 7:1 · UI >= 3:1.

   Inclui um plugin que registra o utilitário de FOCO VISÍVEL
   (.focus-ring / .focus-ring-shadow) e estende fontSize com
   line-height pareado. Compatível com Tailwind v3.
   ============================================================ */

const plugin = require('tailwindcss/plugin');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./**/*.{html,js,jsx,ts,tsx}'],

  theme: {
    extend: {
      /* ========================================================
         1 · COR
         ======================================================== */
      colors: {
        paper: {
          0:   '#ffffff', // cartões / superfícies elevadas
          50:  '#fbf8f1', // fundo da página
          100: '#f5f0e6', // superfície sutil / faixa
          200: '#ece5d6', // hover de superfície
          300: '#ded5c4', // linha / borda padrão
          400: '#c9bea8', // borda forte / divisória
        },
        ink: {
          // texto sobre paper-50:
          900: '#211c17', // texto principal      — 15.9:1 AAA
          800: '#2e2823', // títulos              — 13.0:1 AAA
          700: '#4b4239', // texto secundário     —  9.3:1 AAA
          500: '#756a5e', // metadados/auxiliar   —  5.0:1 AA
          300: '#a89c8c', // placeholder/disabled —  2.9:1 (não usar p/ texto essencial)
        },
        oxblood: {
          50:  '#f7ebe7', // fundo tênue de acento
          600: '#963a2e', // hover claro
          700: '#7e2d24', // acento padrão — texto sobre paper-50 = 8.7:1 AAA · branco sobre ele = 9.2:1 AAA
          800: '#651f18', // pressionado   — branco sobre ele = 11.6:1 AAA
        },
        // Semânticas — reservadas a feedback (não decoram).
        red:   { 700: '#9b2620', 50: '#fbeae8' }, // erro      — red-700 sobre paper-50 = 7.4:1 AAA · sobre red-50 = 6.9:1 AA
        green: { 700: '#1f6b3b', 50: '#e8f1ea' }, // sucesso   — green-700 sobre paper-50 = 6.1:1 AA · sobre green-50 = 5.7:1 AA
        amber: { 700: '#8a5a12', 50: '#f7eedb' }, // alerta    — amber-700 sobre paper-50 = 5.6:1 AA · sobre amber-50 = 5.2:1 AA
        blue:  { 700: '#1b4f8a', 50: '#e8eef6' }, // informação— blue-700 sobre paper-50 = 7.8:1 AAA · sobre blue-50 = 7.3:1 AAA
        focus: '#1f5fd6', // anel de foco — 5.4:1 sobre paper-50 (> 3:1 p/ UI)

        // Aliases semânticos (apontam para a escala acima).
        surface: {
          page:   '#fbf8f1',
          card:   '#ffffff',
          subtle: '#f5f0e6',
          hover:  '#ece5d6',
          accent: '#f7ebe7',
        },
        text: {
          strong:    '#211c17', // >= 15.9:1
          body:      '#2e2823', // >= 13.0:1
          secondary: '#4b4239', // >=  9.3:1
          muted:     '#756a5e', // >=  5.0:1
          disabled:  '#a89c8c', //     2.9:1 (decorativo)
          'on-accent': '#ffffff', // sobre bordô >= 9.2:1
          link:      '#7e2d24', // 8.7:1 — sempre sublinhado
          'link-hover': '#651f18',
        },
        border: {
          subtle:  '#ded5c4',
          DEFAULT: '#c9bea8',
          strong:  '#a89c8c',
        },
      },

      /* ========================================================
         2 · TIPOGRAFIA
         ======================================================== */
      fontFamily: {
        display: ['Spectral', 'Georgia', 'Times New Roman', 'serif'],     // títulos / display
        body:    ['Newsreader', 'Georgia', 'Times New Roman', 'serif'],   // corpo de leitura
        ui:      ['IBM Plex Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'], // rótulos/metadados
        // sans/serif padrão também mapeados p/ conveniência:
        sans:    ['IBM Plex Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif:   ['Newsreader', 'Georgia', 'Times New Roman', 'serif'],
      },

      // Cada tamanho pareado com seu line-height recomendado.
      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1.5' }],  // 12px — metadados (mínimo)
        sm:   ['0.875rem', { lineHeight: '1.5' }],  // 14px — rótulos
        base: ['1rem',     { lineHeight: '1.5' }],  // 16px — UI
        md:   ['1.125rem', { lineHeight: '1.7' }],  // 18px — corpo de leitura
        lg:   ['1.375rem', { lineHeight: '1.25' }], // 22px — subtítulos
        xl:   ['1.75rem',  { lineHeight: '1.25' }], // 28px — título de seção
        '2xl':['2.25rem',  { lineHeight: '1.25' }], // 36px — título de resenha
        '3xl':['2.875rem', { lineHeight: '1.1' }],  // 46px — display
        '4xl':['3.75rem',  { lineHeight: '1.1' }],  // 60px — masthead / herói
      },

      fontWeight: {
        regular:  '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
      },

      lineHeight: {
        tight:   '1.1',  // display
        snug:    '1.25', // subtítulos
        normal:  '1.5',  // UI
        relaxed: '1.7',  // corpo longo
      },

      letterSpacing: {
        tight:  '-0.02em', // títulos display
        normal: '0',
        wide:   '0.02em',
        caps:   '0.08em',  // rótulos em CAIXA ALTA
      },

      maxWidth: {
        prose:       '68ch', // medida de leitura
        'container-prose': '42rem', // ~672px
        'container-md':    '60rem', // ~960px
        'container-lg':    '75rem', // 1200px
      },

      /* ========================================================
         3 · ESPAÇAMENTO E GRID (base 4px)
         ======================================================== */
      spacing: {
        0:  '0',
        1:  '0.25rem', //  4px
        2:  '0.5rem',  //  8px
        3:  '0.75rem', // 12px
        4:  '1rem',    // 16px
        5:  '1.5rem',  // 24px
        6:  '2rem',    // 32px
        7:  '3rem',    // 48px
        8:  '4rem',    // 64px
        9:  '6rem',    // 96px
        'target-min': '2.75rem', // 44px — alvo de toque mínimo
      },

      gap: {
        gutter: '1.5rem', // 24px entre colunas
      },

      /* ========================================================
         4 · RAIO, BORDA, SOMBRA
         ======================================================== */
      borderRadius: {
        none: '0',
        sm:   '4px',   // campos, badges
        md:   '6px',   // botões
        lg:   '10px',  // cartões
        full: '999px', // pílulas, avatares
      },

      borderWidth: {
        DEFAULT: '1px',
        strong:  '2px',
      },

      boxShadow: {
        sm: '0 1px 2px rgba(45, 35, 25, 0.06)',
        md: '0 2px 6px rgba(45, 35, 25, 0.08), 0 1px 2px rgba(45, 35, 25, 0.06)',
        lg: '0 8px 24px rgba(45, 35, 25, 0.10), 0 2px 6px rgba(45, 35, 25, 0.06)',
        // anel de foco como sombra (alternativa ao outline)
        focus: '0 0 0 2px #fbf8f1, 0 0 0 5px #1f5fd6',
      },

      /* ========================================================
         5 · FOCO VISÍVEL — tokens de outline
         ======================================================== */
      outlineWidth: {
        focus: '3px',
      },
      outlineOffset: {
        focus: '2px',
      },
      outlineColor: {
        focus: '#1f5fd6',
      },

      /* ========================================================
         6 · MOVIMENTO
         ======================================================== */
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0.2, 1)',
      },
      transitionDuration: {
        fast:   '120ms',
        normal: '200ms',
      },
    },
  },

  plugins: [
    /* ----------------------------------------------------------
       Utilitário de FOCO VISÍVEL (WCAG 2.4.7 / 1.4.11).
       .focus-ring         → outline azul de 3px + 2px de folga
       .focus-ring-shadow  → mesmo anel via box-shadow (p/ cantos
                             arredondados grandes)
       Ambos respondem a :focus-visible (não poluem o mouse).
       ---------------------------------------------------------- */
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.focus-ring:focus-visible': {
          outline: '3px solid #1f5fd6',
          outlineOffset: '2px',
          borderRadius: '4px',
        },
        '.focus-ring-shadow:focus-visible': {
          outline: 'none',
          boxShadow: '0 0 0 2px #fbf8f1, 0 0 0 5px #1f5fd6',
        },
      });
    }),
  ],
};

/* ============================================================
   Uso com a sintaxe @theme do Tailwind v4 (alternativa ao
   config acima) — descomente em seu CSS de entrada:

   @theme {
     --color-paper-50: #fbf8f1;
     --color-ink-900:  #211c17;
     --color-oxblood-700: #7e2d24;
     --font-display: 'Spectral', Georgia, serif;
     --font-body:    'Newsreader', Georgia, serif;
     --font-ui:      'IBM Plex Sans', system-ui, sans-serif;
     --text-md: 1.125rem;
     --radius-lg: 10px;
     ...
   }
   ============================================================ */
