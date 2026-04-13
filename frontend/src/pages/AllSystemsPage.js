import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Alert,
  Box, 
  Button,
  CircularProgress,
  Container, 
  Fade,
  Grid, 
  InputAdornment,
  Paper,
  Snackbar,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { 
  Computer as ComputerIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import axios from 'axios';

function AllSystemsPage({ user }) {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [scanningSystemId, setScanningSystemId] = useState(null);
  const [reviewingSystemId, setReviewingSystemId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchSystems();
  }, [user]);

  const fetchSystems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/systems', {
        headers: {
          'X-User-ID': user?.user_id?.toString() || '',
          'X-User-Type-ID': user?.user_type_id?.toString() || ''
        }
      });
      setSystems(response.data.systems || []);
      
    } catch (err) {
      console.error('שגיאה בשליפת מערכות:', err);
      setError('שגיאה בטעינת הנתונים');
      setSystems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartScan = async (e, systemId, systemName) => {
    // מניעת ניווט לדף המערכת
    e.preventDefault();
    e.stopPropagation();
    
    setScanningSystemId(systemId);
    try {
      const response = await axios.post('/api/scans/initiate', 
        { system_id: systemId },
        {
          headers: {
            'X-User-ID': user?.user_id?.toString() || '',
            'X-User-Type-ID': user?.user_type_id?.toString() || ''
          }
        }
      );
      
      if (response.data.success) {
        setSnackbar({ 
          open: true, 
          message: `סריקה הופעלה בהצלחה עבור ${systemName}`, 
          severity: 'success' 
        });
      } else {
        setSnackbar({ 
          open: true, 
          message: response.data.message || 'שגיאה בהפעלת סריקה', 
          severity: 'error' 
        });
      }
    } catch (err) {
      console.error('שגיאה בהפעלת סריקה:', err);
      console.error('תגובת שגיאה מלאה:', err.response?.data);
      
      // הצגת הודעת שגיאה מפורטת עם סטטוס קוד
      let errorMessage = 'שגיאה בהפעלת סריקה';
      
      if (err.response?.data) {
        const data = err.response.data;
        
        // אם יש status_code, הוסף אותו להודעה
        if (data.status_code && data.status_code !== 0 && data.status_code !== 'N/A') {
          errorMessage = `סטטוס HTTP ${data.status_code}: ${data.message || data.error || 'המערכת לא זמינה'}`;
        } else {
          errorMessage = data.message || data.error || errorMessage;
        }
        
        console.log('הודעת שגיאה מעובדת:', errorMessage);
      }
      
      setSnackbar({ 
        open: true, 
        message: errorMessage, 
        severity: 'error' 
      });
    } finally {
      setScanningSystemId(null);
    }
  };

  const handleStartCodeReview = async (e, systemId, systemName) => {
    e.preventDefault();
    e.stopPropagation();

    setReviewingSystemId(systemId);
    try {
      const token = localStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        setSnackbar({
          open: true,
          message: 'יש להתחבר מחדש למערכת',
          severity: 'warning'
        });
        setReviewingSystemId(null);
        return;
      }
      const response = await axios.post('/api/code-reviews',
        { system_id: systemId },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setSnackbar({
          open: true,
          message: `סריקת קוד הופעלה בהצלחה עבור ${systemName} (Task ID: ${response.data.task_id})`,
          severity: 'success'
        });
      } else {
        setSnackbar({
          open: true,
          message: response.data.message || 'שגיאה בהפעלת סריקת קוד',
          severity: 'error'
        });
      }
    } catch (err) {
      console.error('שגיאה בהפעלת סריקת קוד:', err);
      const errorMessage = err.response?.data?.message || 'שגיאה בהפעלת סריקת קוד';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setReviewingSystemId(null);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const getSeverityColor = (severity) => {
    switch (severity ? severity.toLowerCase() : '') {
      case 'critical': return '#aa0a21';
      case 'high': return '#f73c57';
      case 'medium': return '#f77f3c';
      case 'low': return '#ffad00';
      default: return '#7f8c8d';
    }
  };

  const filteredSystems = systems.filter(system =>
    (system.name && system.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // כפתורי סריקה לחיצים רק לאדמין או למנהל של אותה מערכת (לפי system.manager ו-full_name)
  const isAdmin = user?.user_type_id === 1 || user?.user_type_id === '1';
  const isManagerOfSystem = (system) => {
    if (!system?.manager || !user?.full_name) return false;
    return system.manager.toLowerCase().includes(user.full_name.toLowerCase());
  };
  const canScanSystem = (system) => isAdmin || isManagerOfSystem(system);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} 
        sx={{
          color: '#A855F7',
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
          }
        }} 
        />
        <Typography variant="h6" sx={{ mt: 2, color: '#ECF0F1' }}>טוען מערכות...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error" sx={{
          borderRadius: 3,
          backgroundColor: 'rgba(231, 76, 60, 0.2)',
          border: '1px solid #E74C3C',
          color: '#E74C3C'
        }}>{error}</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{
      height: 'fit-content',
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
    }}>
      <Container maxWidth="xl" sx={{ py: 4, position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Fade in timeout={600}>
        <Box>
          {/* כותרת וחיפוש */}
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography 
              variant="h3" 
              component="h1" 
              sx={{ 
                mb: 3,
                fontWeight: 800,
                color: '#2c3e50',
                textShadow: '0 2px 4px rgba(44, 62, 80, 0.2)',
                letterSpacing: '0.05em'
              }}
            >
              כל המערכות ({filteredSystems.length})
            </Typography>

            {/* שורת חיפוש */}
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <TextField
                placeholder="חפש מערכת לפי שם..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{
                  maxWidth: 500,
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    '&:hover': {
                      border: '1px solid #A855F7',
                      boxShadow: '0 6px 12px -2px rgba(168, 85, 247, 0.2)',
                    },
                    '&.Mui-focused': {
                      border: '2px solid #A855F7',
                      boxShadow: '0 0 0 3px rgba(168, 85, 247, 0.1)',
                    },
                    '& .MuiOutlinedInput-input': {
                      color: '#2c3e50',
                      '&::placeholder': {
                        color: '#7f8c8d',
                        opacity: 1
                      }
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(168, 85, 247, 0.3)'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#A855F7'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#A855F7'
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#7f8c8d' }} /> 
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </Box>

          {/* רשימת מערכות */}
          {filteredSystems.length === 0 ? (
            <Paper elevation={3} sx={{ 
              p: 6, 
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '12px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
            }}>
              <ComputerIcon sx={{ fontSize: 60, color: '#A855F7', mb: 2, opacity: 0.7 }} />
              <Typography variant="h6" sx={{ color: '#2c3e50', fontWeight: 600 }}>
                אין מערכות זמינות לתצוגה
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {filteredSystems.map((system) => (
                <Grid item xs={12} sm={6} md={4} key={system.id}>
                  <Box 
                      component={Link}
                      to={`/system/${system.id}`}
                      sx={{
                      cursor: 'pointer',
                      backgroundColor: 'rgba(255, 255, 255, 0.85)',
                      borderRadius: '12px',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      transition: 'all 0.2s ease',
                      textDecoration: 'none',
                      display: 'block',
                      height: '100%',
                      '&:hover': {
                          borderColor: '#A855F7',
                          transform: 'translateY(-2px)',
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        }
                      }}
                    >
                    <Box sx={{ 
                      p: 3, 
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%'
                    }}>
                      <Box sx={{ 
                        width: 10, 
                        height: 10, 
                        borderRadius: '50%', 
                        backgroundColor: '#A855F7',
                        mb: 1.5
                          }} />
                      <Typography variant="h6" component="div" sx={{ 
                        fontWeight: 600, 
                        mb: 0.5,
                        color: '#2c3e50'
                          }}>
                            {system.name}
                          </Typography>
                      {system.last_scan_date && (
                        <Typography variant="body2" sx={{ 
                          color: '#7f8c8d',
                          fontSize: '0.9rem',
                          mb: 0.5,
                          fontWeight: 500
                        }}>
                          סריקה אחרונה: {new Date(system.last_scan_date).toLocaleDateString('he-IL')}
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ 
                        color: '#A855F7',
                        fontSize: '0.8rem',
                        mt: 'auto',
                        lineHeight: 1.4
                      }}>
                        {system.vulnerability_count || system.total_vulnerabilities || 0} ממצאים
                      </Typography>
                      
                      {/* כפתורי סריקה - לחיצים רק לאדמין או למנהל המערכת; לאחרים כפתורים מושבתים עם צבע מתאים */}
                      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <Tooltip title={canScanSystem(system) ? "הפעל סריקה" : "פעולה זו מוגבלת לאדמין או למנהל המערכת בלבד"}>
                          <span>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={(e) => handleStartScan(e, system.id, system.name)}
                              disabled={scanningSystemId === system.id || !canScanSystem(system)}
                              sx={{
                                backgroundColor: canScanSystem(system) ? '#27ae60' : '#bdc3c7',
                                color: '#fff',
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                px: 2,
                                py: 0.5,
                                '&:hover': canScanSystem(system) ? {
                                  backgroundColor: '#219a52',
                                } : {},
                                '&:disabled': {
                                  backgroundColor: '#bdc3c7',
                                  color: 'rgba(255,255,255,0.8)',
                                  cursor: 'not-allowed',
                                  pointerEvents: 'auto',
                                }
                              }}
                            >
                              {scanningSystemId === system.id ? 'מפעיל...' : 'הפעל סריקה'}
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title={!system.repo_url ? "לא הוגדר ריפו למערכת זו" : canScanSystem(system) ? "הפעל סריקת קוד" : "פעולה זו מוגבלת לאדמין או למנהל המערכת בלבד"}>
                          <span>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={(e) => handleStartCodeReview(e, system.id, system.name)}
                              disabled={reviewingSystemId === system.id || !system.repo_url || !canScanSystem(system)}
                              sx={{
                                backgroundColor: (canScanSystem(system) && system.repo_url) ? '#A855F7' : '#bdc3c7',
                                color: '#fff',
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                px: 2,
                                py: 0.5,
                                '&:hover': (canScanSystem(system) && system.repo_url) ? {
                                  backgroundColor: '#7C3AED',
                                } : {},
                                '&:disabled': {
                                  backgroundColor: '#bdc3c7',
                                  color: 'rgba(255,255,255,0.8)',
                                  cursor: 'not-allowed',
                                  pointerEvents: 'auto',
                                }
                              }}
                            >
                              {reviewingSystemId === system.id ? 'מפעיל...' : 'סריקת קוד'}
                            </Button>
                          </span>
                        </Tooltip>
                      </Box>
                        </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Fade>
      </Container>
      
      {/* Snackbar להודעות */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ 
            width: '100%',
            borderRadius: 2,
            fontWeight: 500
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default AllSystemsPage; 