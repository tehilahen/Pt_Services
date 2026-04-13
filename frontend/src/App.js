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
// יצירת עיצוב מותאם אישית עם צבעים נעימים יותר
const theme = createTheme({
  direction: 'rtl',
  palette: {
    primary: {
      main: '#2596be', // כחול נעים
      light: '#3ba6d4',
      dark: '#1e7a9a',
    },
    secondary: {
      main: '#ec4899', // ורוד נעים
      light: '#f472b6',
      dark: '#db2777',
    },
    background: {
      default: '#0f172a', // כחול כהה
      paper: '#1e293b', // כחול כהה יותר
    },
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
    },
    success: {
      main: '#10b981', // ירוק נעים
      light: '#34d399',
      dark: '#059669',
    },
    warning: {
      main: '#f59e0b', // כתום נעים
      light: '#fbbf24',
      dark: '#d97706',
    },
    error: {
      main: '#ef4444', // אדום נעים
      light: '#f87171',
      dark: '#dc2626',
    },
  },
  typography: {
    fontFamily: 'Heebo, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { 
      fontWeight: 800, 
      color: '#f8fafc',
      fontSize: '2.5rem',
      letterSpacing: '-0.025em'
    },
    h2: { 
      fontWeight: 700, 
      color: '#f8fafc',
      fontSize: '2rem',
      letterSpacing: '-0.025em'
    },
    h3: { 
      fontWeight: 700, 
      color: '#f8fafc',
      fontSize: '1.75rem',
      letterSpacing: '-0.025em'
    },
    h4: { 
      fontWeight: 600, 
      color: '#f8fafc',
      fontSize: '1.5rem',
      letterSpacing: '-0.025em'
    },
    h5: { 
      fontWeight: 600, 
      color: '#f8fafc',
      fontSize: '1.25rem',
      letterSpacing: '-0.025em'
    },
    h6: { 
      fontWeight: 600, 
      color: '#f8fafc',
      fontSize: '1.125rem',
      letterSpacing: '-0.025em'
    },
    body1: { 
      color: '#e2e8f0',
      fontSize: '1rem',
      lineHeight: 1.6
    },
    body2: { 
      color: '#cbd5e1',
      fontSize: '0.875rem',
      lineHeight: 1.5
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.4), 0 8px 12px -4px rgba(0, 0, 0, 0.15)',
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
          background: 'linear-gradient(135deg, #2596be 0%, #3ba6d4 100%)',
          boxShadow: '0 4px 12px rgba(37, 150, 190, 0.4)',
          '&:hover': {
            background: 'linear-gradient(135deg, #1e7a9a 0%, #2596be 100%)',
            boxShadow: '0 6px 16px rgba(37, 150, 190, 0.5)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 16,
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
          backgroundColor: '#0f172a'
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
        backgroundColor: '#f4f5f9',
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
          overflow: 'hidden'
        }}>
          <Header user={user} onLogout={handleLogout} />
          <main style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
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