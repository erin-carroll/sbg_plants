import { createTheme } from '@mui/material/styles';

// ============================================================
// PALETTE — edit this object to swap color schemes
// ============================================================
export const palette = {
  // Brand / primary actions (buttons, links, active states)
  // EMIT: Earth
  primary: {
    main:         '#0D3E70',
    dark:         '#1A2A42',   // hover state
    light:        '#436B9B',
    contrastText: '#ffffff',
  },

  // Secondary / accent
  // EMIT: Atmosphere
  secondary: {
    main:         '#0091DB',
    dark:         '#087099',   // hover state
    light:        '#9FDCF4',
    contrastText: '#ffffff',
  },

  // Status colors
  success: {
    // EMIT: Mineral green
    main:       '#3E8450',
    background: '#D8EAD3',
  },
  warning: {
    // EMIT: light terracotta
    main:       '#DDA88E',
    background: '#f9ede7',
  },
  error: {
    // EMIT: Terracotta
    main:       '#C16B49',
    background: '#f2ddd5',
  },
  info: {
    // EMIT: deep teal
    main:       '#1E5F68',
    background: '#E4F4F9',
  },

  // Neutrals
  // EMIT: Spectrum / grayscale
  neutral: {
    border:      '#9DAAB2',
    background:  '#D6DFE5',
    overlay:     'rgba(255, 255, 255, 0.8)',
  },
};

// ============================================================
// MUI THEME
// ============================================================
const theme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: palette.primary.main,   dark: palette.primary.dark,   light: palette.primary.light,   contrastText: palette.primary.contrastText },
    secondary: { main: palette.secondary.main, dark: palette.secondary.dark, light: palette.secondary.light, contrastText: palette.secondary.contrastText },
    success:   { main: palette.success.main },
    warning:   { main: palette.warning.main },
    error:     { main: palette.error.main },
    info:      { main: palette.info.main },
  },

  // Component-level defaults — hovers, focus rings, etc. all live here
  components: {
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          '&:hover': { backgroundColor: palette.primary.dark },
        },
        outlined: {
          '&:hover': { backgroundColor: '#CE9E4A', borderColor: '#CE9E4A', color: '#ffffff' },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          '&.Mui-selected': { backgroundColor: '#CE9E4A', color: '#ffffff', borderColor: '#CE9E4A',
            '&:hover': { backgroundColor: '#E1C181', borderColor: '#E1C181' },
          },
          '&:hover': { backgroundColor: '#E1C181', color: '#ffffff' },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: palette.primary.main,
          '&:hover': { color: palette.primary.dark },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: palette.info.background },
        },
      },
    },
  },
});

export default theme;
