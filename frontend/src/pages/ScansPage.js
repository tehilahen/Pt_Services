import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  Button
} from '@mui/material';
import {
  Security as SecurityIcon,
  Visibility as ViewIcon,
  Schedule as ScheduleIcon,
  BugReport as BugIcon,
  Computer as ComputerIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';

function ScansPage({ user }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState(null); // 'name' | 'date'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [page, setPage] = useState(0);
  const rowsPerPage = 8;
  const navigate = useNavigate();

  useEffect(() => {
    fetchScans();
  }, [user]);

  const fetchScans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scans', {
        headers: {
          'X-User-ID': user?.user_id?.toString() || '',
          'X-User-Type-ID': user?.user_type_id?.toString() || ''
        }
      });
      const data = await response.json();

      if (data.error) {
        setError(data.message || 'שגיאה בטעינת הסריקות');
      } else {
        setScans(data.scans || []);
      }
    } catch (err) {
      console.error('שגיאה בטעינת סריקות:', err);
      setError('שגיאה בחיבור לשרת');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case 'completed': 
      case 'הצליח': 
        return '#55c6c2'; // Teal instead of green
      case 'running': return '#3498DB'; // Bright blue (consistent)
      case 'pending': 
      case 'מתחיל': 
        return '#f77f3c'; // Orange instead of yellow
      case 'failed': 
      case 'נכשל': 
        return '#aa0a21'; // Dark red instead of bright red
      case 'cancelled': return '#7f8c8d'; // Gray from home page
      default: return '#7f8c8d'; // Gray from home page
    }
  };

  const getStatusText = (status) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case 'completed': return 'הושלם';
      case 'running': return 'פועל';
      case 'pending': return 'ממתין';
      case 'failed': return 'נכשל';
      case 'cancelled': return 'בוטל';
      // תמיכה בסטטוסים בעברית מהדאטאבייס
      case 'הצליח': return 'הושלם';
      case 'נכשל': return 'נכשל';
      case 'מתחיל': return 'ממתין';
      default: return status || 'לא ידוע';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'לא ידוע';
    const date = new Date(dateString);
    return date.toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '00:00:00';
    
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleViewVulnerabilities = (systemId) => {
    navigate(`/system/${systemId}`);
  };

  // מיון לפי שם מערכת
  const handleSortByName = () => {
    if (sortBy === 'name') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('name');
      setSortDirection('asc');
    }
  };

  // מיון לפי תאריך
  const handleSortByDate = () => {
    if (sortBy === 'date') {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy('date');
      setSortDirection('desc'); // ברירת מחדל: מהחדש לישן
    }
  };

  // מיון הסריקות
  const sortedScans = useMemo(() => {
    if (!sortBy) return scans;
    
    return [...scans].sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = (a.system_name || '').toLowerCase();
        const nameB = (b.system_name || '').toLowerCase();
        if (sortDirection === 'asc') {
          return nameA.localeCompare(nameB, 'he');
        } else {
          return nameB.localeCompare(nameA, 'he');
        }
      } else if (sortBy === 'date') {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        if (sortDirection === 'desc') {
          return dateB - dateA; // חדש לישן
        } else {
          return dateA - dateB; // ישן לחדש
        }
      }
      return 0;
    });
  }, [scans, sortBy, sortDirection]);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} 
          sx={{
            color: '#3498DB', // Bright blue for loading indicator
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
            }
          }} 
          />
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#f8f9fa',
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(52, 152, 219, 0.03)',
        pointerEvents: 'none',
        zIndex: 0
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(138, 43, 226, 0.02)',
        pointerEvents: 'none',
        zIndex: 0
      }
    }}>
      <Container maxWidth="xl" sx={{ py: 3, position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 3 }}>
        <Typography 
          variant="h4" 
          component="h1" 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            mb: 1,
            color: '#2c3e50'
          }}
        >
          <SecurityIcon sx={{ fontSize: 40, color: '#3498DB' }} />
          סריקות אבטחה
        </Typography>
        <Typography variant="body1" 
          sx={{ color: '#34495e' }}> 
          מציג את כל הסריקות שבוצעו במערכת
        </Typography>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3,
            borderRadius: 3,
            backgroundColor: 'rgba(231, 76, 60, 0.15)',
            border: '1px solid #E74C3C',
            color: '#E74C3C'
           }}
        >
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{
        background: '#ffffff',
        border: '1px solid #e0e0e0',
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        direction: 'rtl'
      }}>
          <Table stickyHeader aria-label="scans table" sx={{ direction: 'rtl' }}>
            <TableHead>
              <TableRow>
                <TableCell 
                  align="right" 
                  onClick={handleSortByName}
                  sx={{ 
                    fontWeight: 700, 
                    color: '#ffffff', 
                    backgroundColor: '#3498DB', 
                    borderBottom: 'none', 
                    fontSize: '0.95rem', 
                    py: 1.5,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    '&:hover': { backgroundColor: '#2980b9' }
                  }}
                > 
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-start' }}> 
                    <ComputerIcon sx={{ fontSize: 18 }} />
                    שם המערכת
                    {sortBy === 'name' && (
                      sortDirection === 'asc' 
                        ? <ArrowUpIcon sx={{ fontSize: 18 }} />
                        : <ArrowDownIcon sx={{ fontSize: 18 }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell 
                  align="right" 
                  onClick={handleSortByDate}
                  sx={{ 
                    fontWeight: 700, 
                    color: '#ffffff', 
                    backgroundColor: '#3498DB', 
                    borderBottom: 'none', 
                    fontSize: '0.95rem', 
                    py: 1.5,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    '&:hover': { backgroundColor: '#2980b9' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-start' }}>
                    <ScheduleIcon sx={{ fontSize: 18 }} />
                    תאריך סריקה
                    {sortBy === 'date' && (
                      sortDirection === 'desc' 
                        ? <ArrowDownIcon sx={{ fontSize: 18 }} />
                        : <ArrowUpIcon sx={{ fontSize: 18 }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.9rem', py: 1.5 }}>סטטוס</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.9rem', py: 1.5 }}>משך זמן</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.9rem', py: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-start' }}>
                    <BugIcon sx={{ fontSize: 20 }} />
                    ממצאים
                  </Box>
                </TableCell>
                <TableCell align="center" sx={{ backgroundColor: '#3498DB', borderBottom: 'none', width: '60px', py: 1.5 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedScans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, backgroundColor: '#ffffff' }}>
                    <Typography variant="body1" sx={{ color: '#2c3e50', fontWeight: 500 }}> 
                      לא נמצאו סריקות במערכת
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedScans
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((scan) => (
                  <TableRow 
                    key={scan.id}
                    sx={{
                      cursor: 'pointer',
                      backgroundColor: '#ffffff',
                      '&:hover': { backgroundColor: '#f5f8ff' },
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background-color 0.2s ease',
                    }}
                    onClick={() => handleViewVulnerabilities(scan.system_id)}
                  >
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#1a252f', fontSize: '0.95rem' }}>
                        {scan.system_name}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Typography variant="body2" sx={{ color: '#546e7a', fontSize: '0.9rem' }}>
                        {formatDate(scan.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Box sx={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        px: 2,
                        py: 0.75,
                        borderRadius: 2,
                        bgcolor: `${getStatusColor(scan.scan_status)}15`,
                        border: `2px solid ${getStatusColor(scan.scan_status)}50`
                      }}>
                        <Typography variant="body2" sx={{ 
                          color: getStatusColor(scan.scan_status),
                          fontWeight: 600,
                          fontSize: '0.85rem'
                        }}>
                          {getStatusText(scan.scan_status)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Typography variant="body2" sx={{ color: '#546e7a', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        {formatDuration(scan.scan_duration_seconds)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                        {scan.critical_count > 0 && (
                          <Box sx={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 2,
                            bgcolor: 'rgba(170, 10, 33, 0.1)',
                            border: '2px solid rgba(170, 10, 33, 0.5)'
                          }}>
                            <Typography variant="body2" sx={{ color: '#aa0a21', fontWeight: 600, fontSize: '0.8rem' }}>
                              קריטי: {scan.critical_count}
                            </Typography>
                          </Box>
                        )}
                        {scan.high_count > 0 && (
                          <Box sx={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 2,
                            bgcolor: 'rgba(247, 60, 87, 0.1)',
                            border: '2px solid rgba(247, 60, 87, 0.5)'
                          }}>
                            <Typography variant="body2" sx={{ color: '#f73c57', fontWeight: 600, fontSize: '0.8rem' }}>
                              גבוה: {scan.high_count}
                            </Typography>
                          </Box>
                        )}
                        {scan.medium_count > 0 && (
                          <Box sx={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 2,
                            bgcolor: 'rgba(247, 127, 60, 0.1)',
                            border: '2px solid rgba(247, 127, 60, 0.5)'
                          }}>
                            <Typography variant="body2" sx={{ color: '#f77f3c', fontWeight: 600, fontSize: '0.8rem' }}>
                              בינוני: {scan.medium_count}
                            </Typography>
                          </Box>
                        )}
                        {scan.scan_status?.toLowerCase() === 'failed' ? (
                          <Box sx={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 2,
                            bgcolor: 'rgba(170, 10, 33, 0.1)',
                            border: '2px solid rgba(170, 10, 33, 0.5)'
                          }}>
                            <Typography variant="body2" sx={{ color: '#aa0a21', fontWeight: 600, fontSize: '0.8rem' }}>
                              סריקה נכשלה
                            </Typography>
                          </Box>
                        ) : scan.total_vulnerabilities === 0 && (
                          <Box sx={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 2,
                            bgcolor: 'rgba(170, 10, 33, 0.1)',
                            border: '2px solid rgba(170, 10, 33, 0.5)'
                          }}>
                            <Typography variant="body2" sx={{ color: '#aa0a21', fontWeight: 600, fontSize: '0.8rem' }}>
                              סריקה נכשלה
                            </Typography>
                          </Box>
                        )}
                        {scan.low_count > 0 && (
                          <Box sx={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 2,
                            bgcolor: 'rgba(255, 173, 0, 0.1)',
                            border: '2px solid rgba(255, 173, 0, 0.5)'
                          }}>
                            <Typography variant="body2" sx={{ color: '#cc8a00', fontWeight: 600, fontSize: '0.8rem' }}>
                              נמוך: {scan.low_count}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ py: 1.5 }}>
                      <IconButton
                        size="small"
                        sx={{ 
                          color: '#3498DB',
                          '&:hover': {
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewVulnerabilities(scan.system_id);
                        }}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {sortedScans.length > rowsPerPage && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            gap: 2,
            mt: 2,
            direction: 'rtl'
          }}>
            {page > 0 && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setPage(page - 1)}
                startIcon={<ChevronRightIcon />}
                sx={{
                  color: '#3498DB',
                  borderColor: '#3498DB',
                  '&:hover': { borderColor: '#2980b9', backgroundColor: 'rgba(52, 152, 219, 0.08)' }
                }}
              >
                הקודם
              </Button>
            )}
            <Typography sx={{ color: '#2c3e50', fontWeight: 600, fontSize: '0.95rem' }}>
              עמוד {page + 1} מתוך {Math.ceil(sortedScans.length / rowsPerPage)}
            </Typography>
            {page < Math.ceil(sortedScans.length / rowsPerPage) - 1 && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setPage(page + 1)}
                endIcon={<ChevronLeftIcon />}
                sx={{
                  color: '#3498DB',
                  borderColor: '#3498DB',
                  '&:hover': { borderColor: '#2980b9', backgroundColor: 'rgba(52, 152, 219, 0.08)' }
                }}
              >
                הבא
              </Button>
            )}
          </Box>
        )}

      {scans.length > 0 && (
        <Box sx={{ 
          mt: 1.5, 
          display: 'flex', 
          justifyContent: 'center' 
        }}>
          <Box sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: 2,
            backgroundColor: 'rgba(52, 152, 219, 0.08)',
            border: '1px solid rgba(52, 152, 219, 0.2)'
          }}>
            <SecurityIcon sx={{ color: '#3498DB', fontSize: 18 }} />
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#2c3e50', 
                fontWeight: 600, 
                fontSize: '0.9rem'
              }}
            >
              סה״כ <span style={{ color: '#3498DB', fontWeight: 700 }}>{scans.length}</span> סריקות נמצאו במערכת
            </Typography>
          </Box>
        </Box>
      )}
    </Container>
    </Box>
  );
}

export default ScansPage; 