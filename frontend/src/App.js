import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import GlobalStyles from '@mui/material/GlobalStyles';
import HomePage from './pages/HomePage';
import SystemPageNew from './pages/SystemPageNew';
import AllSystemsPage from './pages/AllSystemsPage';
import AllVulnerabilitiesPage from './pages/AllVulnerabilitiesPage';
import CriticalVulnerabilitiesPage from './pages/CriticalVulnerabilitiesPage';
import HighVulnerabilitiesPage from './pages/HighVulnerabilitiesPage';
import MediumVulnerabilitiesPage from './pages/MediumVulnerabilitiesPage';
import LowVulnerabilitiesPage from './pages/LowVulnerabilitiesPage';
import ScansPage from './pages/ScansPage';
import Header from './components/Header';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import RequestScanPage from './pages/RequestScanPage';
import LoginModal from './components/LoginModal';
import UserManagementPage from './pages/UserManagementPage';
import ManualPTTrackingPage from './pages/ManualPTTrackingPage';
import CodeReviewsPage from './pages/CodeReviewsPage';
import CodeReviewDetailPage from './pages/CodeReviewDetailPage';
import DashboardPage from './pages/DashboardPage';
import {
  APP_ACCENT_GLOW_STRONG,
  APP_BACKGROUND_DEFAULT,
  APP_BACKGROUND_PAPER,
  APP_BORDER_BLUE,
  APP_BORDER_BLUE_SOFT,
  APP_FONT_FAMILY,
  APP_PRIMARY_BLUE,
  APP_PRIMARY_BLUE_DARK,
  APP_PRIMARY_BLUE_LIGHT,
  APP_SEVERITY_CRITICAL,
  APP_SEVERITY_HIGH,
  APP_SEVERITY_LOW,
  APP_SEVERITY_MEDIUM,
  APP_TEXT_PRIMARY,
  APP_TEXT_SECONDARY,
} from './themeTokens';

const theme = createTheme({
  direction: 'rtl',
  palette: {
    mode: 'light',
    primary: {
      main: APP_PRIMARY_BLUE,
      light: APP_PRIMARY_BLUE_LIGHT,
      dark: APP_PRIMARY_BLUE_DARK,
    },
    secondary: {
      main: APP_TEXT_SECONDARY,
      light: '#64748b',
      dark: '#334155',
    },
    divider: APP_BORDER_BLUE_SOFT,
    background: {
      default: APP_BACKGROUND_DEFAULT,
      paper: APP_BACKGROUND_PAPER,
    },
    text: {
      primary: APP_TEXT_PRIMARY,
      secondary: APP_TEXT_SECONDARY,
    },
    success: {
      main: APP_SEVERITY_LOW,
      light: '#A855F7',
      dark: '#7C3AED',
    },
    warning: {
      main: APP_SEVERITY_MEDIUM,
      light: APP_SEVERITY_HIGH,
      dark: '#b45309',
    },
    error: {
      main: APP_SEVERITY_CRITICAL,
      light: '#ef4444',
      dark: '#b91c1c',
    },
  },
  typography: {
    fontFamily: APP_FONT_FAMILY,
    h1: {
      fontWeight: 700,
      color: APP_TEXT_PRIMARY,
      fontSize: '2.5rem',
      letterSpacing: '-0.025em',
    },
    h2: {
      fontWeight: 700,
      color: APP_TEXT_PRIMARY,
      fontSize: '2rem',
      letterSpacing: '-0.025em',
    },
    h3: {
      fontWeight: 700,
      color: APP_TEXT_PRIMARY,
      fontSize: '1.75rem',
      letterSpacing: '-0.025em',
    },
    h4: {
      fontWeight: 600,
      color: APP_TEXT_PRIMARY,
      fontSize: '1.5rem',
      letterSpacing: '-0.025em',
    },
    h5: {
      fontWeight: 600,
      color: APP_TEXT_PRIMARY,
      fontSize: '1.25rem',
      letterSpacing: '-0.025em',
    },
    h6: {
      fontWeight: 600,
      color: APP_TEXT_PRIMARY,
      fontSize: '1.125rem',
      letterSpacing: '-0.025em',
    },
    body1: {
      color: APP_TEXT_PRIMARY,
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      color: APP_TEXT_SECONDARY,
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
          backgroundColor: APP_BACKGROUND_PAPER,
          border: `1px solid ${APP_BORDER_BLUE}`,
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 8px 24px -6px rgba(15, 23, 42, 0.1)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          padding: '10px 24px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        contained: {
          background: APP_PRIMARY_BLUE,
          backgroundImage: 'none',
          boxShadow: `0 1px 2px rgba(15, 23, 42, 0.06), 0 2px 8px ${APP_ACCENT_GLOW_STRONG}`,
          '&:hover': {
            background: APP_PRIMARY_BLUE_DARK,
            backgroundImage: 'none',
            boxShadow: `0 4px 14px ${APP_ACCENT_GLOW_STRONG}`,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: APP_BACKGROUND_PAPER,
          border: `1px solid ${APP_BORDER_BLUE}`,
          borderRadius: 16,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: APP_BORDER_BLUE,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: APP_BORDER_BLUE_SOFT,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          fontSize: '0.75rem',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid',
        },
      },
    },
  },
  shape: {
    borderRadius: 12,
  },
});

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    // Check if user is logged in on component mount
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Show login modal if user is not logged in
    if (!isLoading && !user) {
      setLoginModalOpen(true);
    }
  }, [user, isLoading]);


  const handleLogin = (userData) => {
    setUser(userData);
    setLoginModalOpen(false);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setLoginModalOpen(true);
  };

  if (isLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          backgroundColor: APP_BACKGROUND_DEFAULT,
          color: APP_TEXT_SECONDARY
        }}>
          <div>טוען...</div>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={`
        @keyframes backgroundPan {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 100% 100%;
          }
        }
      `}/>
      
      {/* Main Application Content */}
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex',
        backgroundColor: APP_BACKGROUND_DEFAULT,
        filter: !user ? 'blur(5px)' : 'none',
        pointerEvents: !user ? 'none' : 'auto',
        transition: 'filter 0.3s ease-in-out'
      }}>
        {/* בר צדדי */}
        <Sidebar user={user} onLogout={handleLogout} />
        
        {/* תוכן ראשי */}
        <div style={{ 
          flex: 1, 
          marginLeft: '280px', 
          display: 'flex', 
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          backgroundColor: APP_BACKGROUND_DEFAULT,
          minHeight: 0,
        }}>
          <Header user={user} onLogout={handleLogout} />
          <main style={{ flex: 1, padding: 0, overflow: 'hidden', backgroundColor: APP_BACKGROUND_DEFAULT, minHeight: 0 }}>
            <Routes>
              <Route path="/" element={<HomePage user={user} />} />
              <Route path="/system/:id" element={<SystemPageNew />} />
              <Route path="/systems" element={<AllSystemsPage user={user} />} />
              <Route path="/scans" element={<ScansPage user={user} />} />
              <Route
                path="/code-reviews"
                element={
                  (user?.user_type_id === 1 || user?.user_type_id === '1' || user?.user_type_id === 2 || user?.user_type_id === '2')
                    ? <CodeReviewsPage user={user} />
                    : <Navigate to="/" replace />
                }
              />
              <Route
                path="/code-reviews/:id"
                element={
                  (user?.user_type_id === 1 || user?.user_type_id === '1' || user?.user_type_id === 2 || user?.user_type_id === '2')
                    ? <CodeReviewDetailPage user={user} />
                    : <Navigate to="/" replace />
                }
              />
              <Route path="/vulnerabilities" element={<AllVulnerabilitiesPage user={user} />} />
              <Route path="/vulnerabilities/critical" element={<CriticalVulnerabilitiesPage user={user} />} />
              <Route path="/vulnerabilities/high" element={<HighVulnerabilitiesPage user={user} />} />
              <Route path="/vulnerabilities/medium" element={<MediumVulnerabilitiesPage user={user} />} />
              <Route path="/vulnerabilities/low" element={<LowVulnerabilitiesPage user={user} />} />
              <Route path="/request-scan" element={<RequestScanPage />} />
              <Route path="/dashboard" element={<DashboardPage user={user} />} />
              {/* Admin Routes - Only for Admin users (UserTypeID = 1) */}
              <Route 
                path="/admin/users" 
                element={
                  (user?.user_type_id === 1 || user?.user_type_id === '1')
                    ? <UserManagementPage user={user} /> 
                    : <Navigate to="/" replace />
                } 
              />
              <Route 
                path="/admin/pt-tracking" 
                element={
                  (user?.user_type_id === 1 || user?.user_type_id === '1')
                    ? <ManualPTTrackingPage user={user} /> 
                    : <Navigate to="/" replace />
                } 
              />
            </Routes>
          </main>
          {isHomePage && <Footer />}
        </div>
      </div>

      {/* Login Modal - Always present, controlled by state */}
      <LoginModal
        open={loginModalOpen}
        onClose={() => {}} // Prevent closing when login is mandatory
        onLogin={handleLogin}
        mandatory={!user}
      />
    </ThemeProvider>
  );
}

export default App; 