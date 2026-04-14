import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Box, 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Chip, 
  IconButton,
  Paper,
  CircularProgress,
  Alert,
  Fade,
  TextField,
  InputAdornment,
  Button
} from '@mui/material';
import { 
  Security as SecurityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ReportProblem as ReportProblemIcon,
  ArrowForward as ArrowForwardIcon,
  Computer as ComputerIcon,
  TrendingUp as TrendingUpIcon,
  Shield as ShieldIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import axios from 'axios';
import {
  APP_BACKGROUND_DEFAULT,
  APP_BORDER_BLUE,
  APP_PRIMARY_BLUE,
  APP_ACCENT_DARK,
  APP_TEXT_PRIMARY,
  APP_TEXT_SECONDARY,
} from '../themeTokens';

// נתוני דמה למקרה שהשרת לא זמין
const mockSystems = [
  {
    id: 'no-connection',
    name: 'אין מערכות זמינות לתצוגה',
    ip_address: '',
    port: 0,
    total_vulnerabilities: 0,
    vulnerability_count: 0,
    critical_count: 0,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    report_date: '',
    created_at: '',
    isPlaceholder: true
  }
];

const mockStats = {
  systems: { total_systems: 0, unique_ips: 0 },
  vulnerabilities: { 
    total: 0,
    breakdown: {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0
    }
  }
};

function HomePage({ user }) {
  const [systems, setSystems] = useState([]);
  const [stats, setStats] = useState(null);
  const [scansCount, setScansCount] = useState(0);
  const [statusStats, setStatusStats] = useState({ 'בטיפול': 0, 'טופל': 0, 'התעלם': 0, 'סגור': 0 });
  const mockScansCount = 0;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [activeSystemIndex, setActiveSystemIndex] = useState(0);


  useEffect(() => {
    fetchData();
  }, []);


  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // הגדרת headers משותפים
      const headers = {
        'X-User-ID': user?.user_id?.toString() || '',
        'X-User-Type-ID': user?.user_type_id?.toString() || ''
      };

      // שליפת כל הנתונים במקביל עם Promise.all - שיפור ביצועים משמעותי
      const [systemsRes, statsRes, scansRes, statusRes] = await Promise.all([
        axios.get('/api/systems', { headers }).catch(err => ({ error: err, data: { systems: [] } })),
        axios.get('/api/stats', { headers }).catch(err => ({ error: err, data: null })),
        axios.get('/api/scans', { headers }).catch(err => ({ error: err, data: { count: 0 } })),
        axios.get('/api/stats/vulnerabilities-status', { headers }).catch(err => ({ error: err, data: { status_stats: null } }))
      ]);

      // בדיקה אם כל הקריאות נכשלו (השרת לא זמין)
      const allFailed = systemsRes.error && statsRes.error && scansRes.error && statusRes.error;
      if (allFailed) {
        setServerStatus('disconnected');
        setSystems(mockSystems);
        setStats(mockStats);
        setScansCount(mockScansCount);
        setStatusStats({ 'בטיפול': 0, 'טופל': 0, 'התעלם': 0, 'סגור': 0 });
        setLoading(false);
        return;
      }

      setServerStatus('connected');

      // עיבוד מערכות
      if (!systemsRes.error) {
        const systemsData = systemsRes.data.systems || [];
        // מיון לפי תאריך סריקה אחרון (המערכות האחרונות שנבדקו קודם)
        const sortedSystems = systemsData.sort((a, b) => {
          const dateA = a.last_scan_date ? new Date(a.last_scan_date) : new Date(0);
          const dateB = b.last_scan_date ? new Date(b.last_scan_date) : new Date(0);
          return dateB - dateA; // סדר יורד - האחרונות קודם
        });
        setSystems(sortedSystems);
      } else {
        setSystems(mockSystems);
      }

      // עיבוד סטטיסטיקות
      if (!statsRes.error && statsRes.data) {
        setStats(statsRes.data);
      } else {
        setStats(mockStats);
      }

      // עיבוד סריקות
      if (!scansRes.error) {
        setScansCount(scansRes.data.count || 0);
      } else {
        setScansCount(0);
      }

      // עיבוד סטטיסטיקות סטטוס
      if (!statusRes.error && statusRes.data.status_stats) {
        setStatusStats(statusRes.data.status_stats);
      } else {
        setStatusStats({ 'בטיפול': 0, 'טופל': 0, 'התעלם': 0, 'סגור': 0 });
      }

      setLoading(false);
    } catch (error) {
      setError('שגיאה בטעינת נתונים מהשרת - משתמש בנתוני דמה');
      setLoading(false);
      setSystems(mockSystems);
      setStats(mockStats);
      setScansCount(mockScansCount);
      setStatusStats({ 'בטיפול': 0, 'טופל': 0, 'התעלם': 0, 'סגור': 0 });
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#eab308';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return <WarningIcon color="error" />;
      case 'high':
        return <WarningIcon sx={{ color: '#f59e0b' }} />;
      case 'medium':
        return <WarningIcon sx={{ color: '#eab308' }} />;
      case 'low':
        return <ReportProblemIcon sx={{ color: '#ffad00' }} />;
      default:
        return <SecurityIcon />;
    }
  };

  // Removed handleCloseSnackbar as per edit hint





  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress 
          size={60} 
          sx={{ 
            color: '#8A2BE2', // Blue Violet for loading indicator
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
            }
          }} 
        />
        <Typography variant="body1" color="text.secondary">
          טוען נתונים...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: 'fit-content',
      display: 'flex',
      flexDirection: 'column',
      background: APP_BACKGROUND_DEFAULT,
    }}>
      <Container maxWidth="xl" sx={{ py: 2, position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {/* Server Status Alert */}
      {serverStatus === 'disconnected' && (
        <Fade in={true} timeout={1000}>
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 2,
              borderRadius: 3,
              backgroundColor: 'rgba(243, 156, 18, 0.15)', // Orange with transparency
              border: '1px solid #f39c12', // Orange border
              color: '#d68910', // Dark orange text
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(10px)',
              '& .MuiAlert-icon': {
                color: '#f39c12' // Orange icon
              }
            }}
          >
            השרת לא זמין - מציג נתוני דמה
          </Alert>
        </Fade>
      )}

      {/* Section: מערכות אחרונות שנבדקו - הועבר לראש הדף */}
      <Fade in={true} timeout={800}>
        <Box sx={{ mb: 3 }}>
          <Typography 
            variant="h6" 
            component="h2" 
            sx={{ 
              mb: 1,
              textAlign: 'center',
              fontWeight: 700,
              color: APP_TEXT_PRIMARY,
              letterSpacing: '-0.02em',
              position: 'relative',
              fontSize: '1.25rem',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: '-4px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '70px',
                height: '2px',
                background: `linear-gradient(90deg, ${APP_PRIMARY_BLUE}, ${APP_ACCENT_DARK})`,
                borderRadius: 0,
              }
            }}
          >
            מערכות אחרונות שנבדקו
          </Typography>

          {/* Systems Grid */}
          <Box sx={{ mb: 2 }}>
            {systems.length > 0 ? (
              <Box sx={{ position: 'relative' }}>
                {/* קרוסלה */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  pt: 1,
                  pb: 1,
                  position: 'relative',
                  minHeight: 200,
                  overflow: 'hidden'
                }}>
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    alignItems: 'center',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    overflowY: 'visible',
                    px: 3,
                    pt: 2,
                    pb: 1
                  }}>
                    {systems.slice(0, 5).map((system, index) => {
                      const isActive = index === activeSystemIndex;
                      
                      return (
                        <Box 
                          key={system.id}
                          component={system.isPlaceholder ? 'div' : Link}
                          to={system.isPlaceholder ? undefined : `/system/${system.id}`}
                          onMouseEnter={() => setActiveSystemIndex(index)}
                          sx={{ 
                            width: 230,
                            height: 175,
                            textDecoration: 'none',
                            backgroundColor: 'rgba(255, 255, 255, 0.85)',
                            borderRadius: '20px',
                            border: 'none',
                            outline: 'none',
                            cursor: system.isPlaceholder ? 'default' : 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'block',
                            position: 'relative',
                            boxShadow: isActive 
                              ? '0 10px 20px rgba(0, 0, 0, 0.10)'
                              : '0 6px 14px rgba(0, 0, 0, 0.06)',
                            overflow: 'hidden',
                            '&:focus': { outline: 'none' },
                            '&:focus-visible': { outline: 'none' },
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '2px',
                              background: isActive 
                                ? 'linear-gradient(90deg, rgba(168,85,247,0.55), rgba(168,85,247,0.2), rgba(168,85,247,0.55))'
                                : 'linear-gradient(90deg, rgba(168,85,247,0.35), rgba(168,85,247,0.12), rgba(168,85,247,0.35))',
                              borderRadius: '20px 20px 0 0'
                            },
                            '&:hover': !system.isPlaceholder ? {
                              transform: 'translateY(-5px)',
                              boxShadow: '0 12px 24px rgba(0, 0, 0, 0.12)'
                            } : {}
                          }}
                        >
                          <Box sx={{ 
                            p: 2, 
                            height: '100%', 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            position: 'relative',
                            zIndex: 1,
                            justifyContent: 'center',
                            gap: 1
                          }}>
                            <ComputerIcon sx={{ 
                              fontSize: 44,
                              color: APP_TEXT_SECONDARY,
                              flexShrink: 0
                            }} />
                            
                            <Typography variant="h6" sx={{ 
                              fontWeight: 700, 
                              color: APP_TEXT_PRIMARY,
                              fontSize: '1.15rem',
                              textAlign: 'center',
                              lineHeight: 1.2,
                              minHeight: '1.2em',
                              maxHeight: '1.2em',
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textShadow: 'none',
                              letterSpacing: '0.3px',
                              wordBreak: 'break-word',
                              px: 0.5,
                              flexShrink: 0
                            }}>
                              {system.name}
                            </Typography>
                            
                            {system.last_scan_date && (
                              <Typography variant="body2" sx={{ 
                                color: APP_TEXT_SECONDARY,
                                fontSize: '0.85rem',
                                textAlign: 'center',
                                flexShrink: 0
                              }}>
                                סריקה: {new Date(system.last_scan_date).toLocaleDateString('he-IL')}
                              </Typography>
                            )}
                            
                            <Box sx={{ 
                              flexShrink: 0,
                              width: '100%',
                              display: 'flex',
                              justifyContent: 'center'
                            }}>
                              <Chip 
                                label={`${system.total_vulnerabilities || system.vulnerability_count || 0} ממצאים`}
                                size="medium"
                                sx={{ 
                                  bgcolor: isActive 
                                    ? 'rgba(168, 85, 247, 0.14)'
                                    : 'rgba(168, 85, 247, 0.08)',
                                  color: APP_PRIMARY_BLUE,
                                  fontWeight: 700,
                                  fontSize: '1rem',
                                  height: 32,
                                  border: `1px solid ${APP_BORDER_BLUE}`,
                                  boxShadow: `0 4px 12px rgba(0, 0, 0, ${isActive ? 0.10 : 0.06})`,
                                  backdropFilter: 'blur(10px)',
                                  textShadow: 'none',
                                  '&:hover': {
                                    bgcolor: 'rgba(168, 85, 247, 0.2)',
                                    transform: 'translateY(-1px)',
                                    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)'
                                  },
                                  transition: 'all 0.3s ease',
                                  maxWidth: '90%'
                                }}
                              />
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>

                {/* אינדיקטורים לקרוסלה */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: 1.5, 
                  mt: 2,
                  mb: 2 
                }}>
                  {systems.slice(0, 5).map((_, index) => (
                    <Box
                      key={index}
                      onClick={() => setActiveSystemIndex(index)}
                      sx={{
                        width: index === activeSystemIndex ? 24 : 12,
                        height: 4,
                        borderRadius: '2px',
                        bgcolor: index === activeSystemIndex 
                          ? APP_PRIMARY_BLUE
                          : 'rgba(168, 85, 247, 0.35)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          bgcolor: index === activeSystemIndex 
                            ? APP_PRIMARY_BLUE
                            : 'rgba(168, 85, 247, 0.55)',
                        }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center' }}>
                <ComputerIcon sx={{ fontSize: 60, color: APP_TEXT_SECONDARY, mb: 2 }} />
                <Typography variant="h6" sx={{ color: APP_TEXT_PRIMARY, fontWeight: 600 }}>
                  אין מערכות זמינות לתצוגה
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Fade>

        {/* Section 1: סטטיסטיקות כלליות */}
        {stats && (
        <Fade in={true} timeout={1000}>
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2} justifyContent="center">
              <Grid item xs={12} sm={5} md={4}>
                <Box 
                  component={Link}
                  to="/systems"
                  sx={{ 
                    cursor: 'pointer',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: `1px solid ${APP_BORDER_BLUE}`,
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                    transition: 'all 0.2s ease',
                    textDecoration: 'none',
                    display: 'block',
                    position: 'relative',
                    overflow: 'hidden',
                    height: 140,
                    '&:hover': {
                      borderColor: APP_PRIMARY_BLUE,
                      transform: 'translateY(-2px)',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 8px 24px rgba(168, 85, 247, 0.12)',
                    }
                  }}
                >
                  <Box sx={{ p: 2.5, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
                    <ComputerIcon sx={{ fontSize: 32, color: APP_PRIMARY_BLUE, mb: 1.5 }} />
                    <Typography variant="h4" component="div" sx={{ fontWeight: 700, mb: 1, color: APP_TEXT_PRIMARY, fontSize: '2rem' }}>
                      {stats?.systems?.total_systems || 0}
                    </Typography>
                    <Typography variant="body1" sx={{ color: APP_PRIMARY_BLUE, fontWeight: 600, fontSize: '1rem' }}>
                      מערכות
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} sm={5} md={4}>
                <Box 
                  sx={{ 
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: `1px solid ${APP_BORDER_BLUE}`,
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                    transition: 'all 0.2s ease',
                    display: 'block',
                    position: 'relative',
                    overflow: 'hidden',
                    height: 140,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px rgba(168, 85, 247, 0.1)',
                    }
                  }}
                >
                  <Box sx={{ p: 2.5, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
                    <CheckCircleIcon sx={{ fontSize: 32, color: '#27ae60', mb: 1.5 }} />
                    <Typography variant="h4" component="div" sx={{ fontWeight: 700, mb: 1, color: APP_TEXT_PRIMARY, fontSize: '1.75rem' }}>
                      {statusStats['טופל'] || 0}/{stats?.vulnerabilities?.total || 0}
                    </Typography>
                    <Typography variant="body1" sx={{ color: APP_PRIMARY_BLUE, fontWeight: 600, fontSize: '1rem' }}>
                      ממצאים שטופלו
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Fade>
        )}

        {/* Section 2: ממצאים לפי רמת חומרה */}
        {stats && (
        <Fade in={true} timeout={1000}>
          <Box sx={{ mb: 3 }}>
            {/* 4 קופסאות חומרה בשורה אחת */}
            <Grid container spacing={2} justifyContent="center">
              <Grid item xs={6} sm={3} md={3}>
                <Box 
                  component={Link}
                  to="/vulnerabilities/critical"
                  sx={{ 
                    cursor: 'pointer',
                    borderRadius: '14px',
                    border: `1px solid ${APP_BORDER_BLUE}`,
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                    transition: 'all 0.2s ease',
                    textDecoration: 'none',
                    display: 'block',
                    position: 'relative',
                    overflow: 'hidden',
                    height: 130,
                    backgroundColor: '#ffffff',
                    '&:hover': {
                      boxShadow: '0 6px 16px rgba(168, 85, 247, 0.12)',
                      transform: 'translateY(-2px)',
                      backgroundColor: '#ffffff',
                    }
                  }}
                >
                  <Box sx={{ p: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
                    <WarningIcon sx={{ fontSize: 28, color: '#aa0a21', mb: 1 }} />
                    <Typography variant="h4" component="div" sx={{ fontWeight: 700, mb: 0.5, color: APP_TEXT_PRIMARY, fontSize: '2rem' }}>
                      {stats?.vulnerabilities?.breakdown?.Critical || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ color: APP_TEXT_SECONDARY, fontWeight: 600, fontSize: '0.9rem' }}>
                      קריטי
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={6} sm={3} md={3}>
                <Box 
                  component={Link}
                  to="/vulnerabilities/high"
                  sx={{ 
                    cursor: 'pointer',
                    borderRadius: '14px',
                    border: `1px solid ${APP_BORDER_BLUE}`,
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                    transition: 'all 0.2s ease',
                    textDecoration: 'none',
                    display: 'block',
                    position: 'relative',
                    overflow: 'hidden',
                    height: 130,
                    backgroundColor: '#ffffff',
                    '&:hover': {
                      boxShadow: '0 6px 16px rgba(168, 85, 247, 0.12)',
                      transform: 'translateY(-2px)',
                      backgroundColor: '#ffffff',
                    }
                  }}
                >
                  <Box sx={{ p: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
                    <WarningIcon sx={{ fontSize: 28, color: '#f73c57', mb: 1 }} />
                    <Typography variant="h4" component="div" sx={{ fontWeight: 700, mb: 0.5, color: APP_TEXT_PRIMARY, fontSize: '2rem' }}>
                      {stats?.vulnerabilities?.breakdown?.High || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ color: APP_TEXT_SECONDARY, fontWeight: 600, fontSize: '0.9rem' }}>
                      גבוה
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={6} sm={3} md={3}>
                <Box 
                  component={Link}
                  to="/vulnerabilities/medium"
                  sx={{ 
                    cursor: 'pointer',
                    borderRadius: '14px',
                    border: `1px solid ${APP_BORDER_BLUE}`,
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                    transition: 'all 0.2s ease',
                    textDecoration: 'none',
                    display: 'block',
                    position: 'relative',
                    overflow: 'hidden',
                    height: 130,
                    backgroundColor: '#ffffff',
                    '&:hover': {
                      boxShadow: '0 6px 16px rgba(168, 85, 247, 0.12)',
                      transform: 'translateY(-2px)',
                      backgroundColor: '#ffffff',
                    }
                  }}
                >
                  <Box sx={{ p: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
                    <WarningIcon sx={{ fontSize: 28, color: '#f77f3c', mb: 1 }} />
                    <Typography variant="h4" component="div" sx={{ fontWeight: 700, mb: 0.5, color: APP_TEXT_PRIMARY, fontSize: '2rem' }}>
                      {stats?.vulnerabilities?.breakdown?.Medium || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ color: APP_TEXT_SECONDARY, fontWeight: 600, fontSize: '0.9rem' }}>
                      בינוני
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={6} sm={3} md={3}>
                <Box 
                  component={Link}
                  to="/vulnerabilities/low"
                  sx={{ 
                    cursor: 'pointer',
                    borderRadius: '14px',
                    border: `1px solid ${APP_BORDER_BLUE}`,
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                    transition: 'all 0.2s ease',
                    textDecoration: 'none',
                    display: 'block',
                    position: 'relative',
                    overflow: 'hidden',
                    height: 130,
                    backgroundColor: '#ffffff',
                    '&:hover': {
                      boxShadow: '0 6px 16px rgba(168, 85, 247, 0.12)',
                      transform: 'translateY(-2px)',
                      backgroundColor: '#ffffff',
                    }
                  }}
                >
                  <Box sx={{ p: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
                    <ReportProblemIcon sx={{ fontSize: 28, color: '#ffad00', mb: 1 }} />
                    <Typography variant="h4" component="div" sx={{ fontWeight: 700, mb: 0.5, color: APP_TEXT_PRIMARY, fontSize: '2rem' }}>
                      {stats?.vulnerabilities?.breakdown?.Low || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ color: APP_TEXT_SECONDARY, fontWeight: 600, fontSize: '0.9rem' }}>
                      נמוך
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Fade>
        )}

      </Container>
    </Box>
  );
}

export default HomePage; 