import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1E88E5',
      light: '#42A5F5',
      dark: '#1565C0'
    },
    secondary: {
      main: '#43A047',
      light: '#66BB6A',
      dark: '#2E7D32'
    },
    error: {
      main: '#E53935'
    },
    warning: {
      main: '#FFC107'
    },
    info: {
      main: '#29B6F6'
    },
    success: {
      main: '#43A047'
    },
    text: {
      primary: '#263238',
      secondary: '#546E7A'
    },
    background: {
      default: '#FAFAFA',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: [
      'Heebo',
      'Rubik',
      'Segoe UI',
      'Tahoma',
      'Geneva',
      'Verdana',
      'sans-serif'
    ].join(','),
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 800 },
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
          backgroundColor: 'rgba(255, 255, 255, 0.9)'
        }
      }
    }
  }
});

export default theme; 