import { createTheme } from '@mui/material/styles';
import {
  APP_BACKGROUND_DEFAULT,
  APP_BACKGROUND_PAPER,
  APP_FONT_FAMILY,
  APP_PRIMARY_BLUE,
  APP_PRIMARY_BLUE_DARK,
  APP_PRIMARY_BLUE_LIGHT,
  APP_SEVERITY_CRITICAL,
  APP_SEVERITY_LOW,
  APP_SEVERITY_MEDIUM,
  APP_TEXT_PRIMARY,
  APP_TEXT_SECONDARY,
} from './themeTokens';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: APP_PRIMARY_BLUE,
      light: APP_PRIMARY_BLUE_LIGHT,
      dark: APP_PRIMARY_BLUE_DARK
    },
    secondary: {
      main: APP_TEXT_SECONDARY,
      light: '#64748B',
      dark: '#1E293B'
    },
    error: {
      main: APP_SEVERITY_CRITICAL
    },
    warning: {
      main: APP_SEVERITY_MEDIUM
    },
    info: {
      main: APP_PRIMARY_BLUE
    },
    success: {
      main: APP_SEVERITY_LOW
    },
    text: {
      primary: APP_TEXT_PRIMARY,
      secondary: APP_TEXT_SECONDARY
    },
    background: {
      default: APP_BACKGROUND_DEFAULT,
      paper: APP_BACKGROUND_PAPER
    }
  },
  typography: {
    fontFamily: APP_FONT_FAMILY,
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 }
  },
  shape: {
    borderRadius: 12
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 10
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined'
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: APP_BACKGROUND_PAPER
        }
      }
    }
  }
});

export default theme;
