import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Box,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  Paper,
  Fade
} from '@mui/material';
import {
  ArrowForward as ArrowBackIcon,
  Security as SecurityIcon,
  Computer as ComputerIcon,
  NetworkCheck as NetworkIcon,
  BugReport as BugReportIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import axios from 'axios';

function SystemPageNew() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [system, setSystem] = useState(null);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vulnerabilityStatuses, setVulnerabilityStatuses] = useState({});
  const [selectedVulnerability, setSelectedVulnerability] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastScanDate, setLastScanDate] = useState(null);

  const handleOpenDialog = (vuln) => {
    setSelectedVulnerability(vuln);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedVulnerability(null);
  };

  useEffect(() => {
    fetchSystemData();
  }, [id]);

  const fetchSystemData = async () => {
    try {
      setLoading(true);
      console.log(`טוען נתונים למערכת ${id}`);

      // בדיקה ראשונית - איזה מערכות קיימות
      try {
        const allSystemsResponse = await axios.get('/api/systems');
        console.log('כל המערכות הקיימות:', allSystemsResponse.data);
        
        const availableSystems = allSystemsResponse.data.systems || [];
        console.log(`יש ${availableSystems.length} מערכות במסד הנתונים`);
        
        if (availableSystems.length === 0) {
          setError('אין מערכות במסד הנתונים');
          setLoading(false);
          return;
        }

        // בדיקה אם המערכת הנוכחית קיימת
        const currentSystem = availableSystems.find(sys => sys.id == id);
        if (!currentSystem) {
          const systemIds = availableSystems.map(sys => sys.id).join(', ');
          setError(`מערכת ${id} לא קיימת. מערכות זמינות: ${systemIds}`);
          setLoading(false);
          return;
        }
      } catch (systemsError) {
        console.error('שגיאה בשליפת רשימת מערכות:', systemsError);
      }

      // שליפת פרטי המערכת
      const systemResponse = await axios.get(`/api/systems/${id}`);
      console.log('תגובת השרת למערכת:', systemResponse.data);
      const systemData = systemResponse.data.system;
      
      if (!systemData) {
        setError('מערכת לא נמצאה');
        setLoading(false);
        return;
      }

      console.log('מערכת נמצאה:', systemData);
      setSystem(systemData);

      // שליפת ממצאים של המערכת
      const vulnerabilitiesResponse = await axios.get(`/api/systems/${id}/vulnerabilities`);
      console.log('תגובת השרת לממצאים:', vulnerabilitiesResponse.data);
      const vulnerabilitiesData = vulnerabilitiesResponse.data.vulnerabilities || [];
      
      console.log(`נמצאו ${vulnerabilitiesData.length} ממצאים`);
      
      // מיון הממצאים לפי רמת חומרה
      const sortedVulnerabilities = vulnerabilitiesData.sort((a, b) => {
        const severityOrder = { 'Critical': 1, 'High': 2, 'Medium': 3, 'Low': 4 };
        return (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5);
      });
      
      setVulnerabilities(sortedVulnerabilities);

      // Initialize statuses from DB or default
      const initialStatuses = {};
      sortedVulnerabilities.forEach(vuln => {
        // שימוש בסטטוס מה-DB אם קיים, אחרת ברירת מחדל
        initialStatuses[vuln.id || `${vuln.system_id}-${vuln.osvdb_id}`] = vuln.status || 'בטיפול';
      });
      setVulnerabilityStatuses(initialStatuses);

      // שליפת תאריך הסריקה האחרונה
      try {
        const scansResponse = await axios.get('/api/scans');
        const allScans = scansResponse.data.scans || [];
        
        // סינון סריקות לפי system_id ומציאת האחרונה
        const systemScans = allScans.filter(scan => scan.system_id == id);
        if (systemScans.length > 0) {
          // מיון לפי תאריך יצירה (מהאחרון לראשון)
          const sortedScans = systemScans.sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
          );
          setLastScanDate(sortedScans[0].created_at);
        }
      } catch (scanError) {
        console.error('שגיאה בשליפת סריקות:', scanError);
        // לא נעצור את הטעינה בגלל שגיאה בסריקות
      }
 
      setLoading(false);
    } catch (error) {
      console.error('שגיאה בטעינת נתונים:', error);
      console.error('פרטי השגיאה:', error.response?.data);
      setError('שגיאה בטעינת נתוני המערכת');
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return '#aa0a21'; // Dark red from home page
      case 'high': return '#f73c57'; // Bright red from home page
      case 'medium': return '#f77f3c'; // Orange from home page
      case 'low': return '#ffad00'; // Yellow-orange from home page
      default: return '#7f8c8d'; // Gray from home page
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return <ErrorIcon sx={{ color: '#aa0a21' }} />;
      case 'high': return <WarningIcon sx={{ color: '#f73c57' }} />;
      case 'medium': return <InfoIcon sx={{ color: '#f77f3c' }} />;
      case 'low': return <CheckCircleIcon sx={{ color: '#ffad00' }} />;
      default: return <BugReportIcon sx={{ color: '#7f8c8d' }} />;
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress size={60} sx={{ mb: 3,
            color: '#3498DB', // Bright blue for loading indicator
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
            }
           }} />
          <Typography variant="h6" 
           sx={{ color: '#2c3e50' }}>
            טוען נתוני מערכת...
          </Typography>
          <Typography variant="body2" 
           sx={{ color: '#7f8c8d', mt: 1 }}>
            מערכת ID: {id}
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 4,
          borderRadius: 3,
          backgroundColor: 'rgba(231, 76, 60, 0.2)',
          border: '1px solid #E74C3C',
          color: '#E74C3C'
         }}>
          {error}
        </Alert>
        
        <Box display="flex" gap={2} flexWrap="wrap">
          <Button
            variant="contained"
            onClick={() => navigate('/')}
            sx={{ 
              backgroundColor: '#3498DB',
              color: 'white',
              '&:hover': { backgroundColor: '#55c6c2' }
            }}
            startIcon={<ArrowBackIcon sx={{ color: 'white' }} />}
          >
            חזרה לדף הבית
          </Button>
        </Box>
      </Container>
    );
  }

  const handleStatusChange = async (vulnId, newStatus, vulnDbId) => {
    try {
      // עדכון מיידי ב-UI
      setVulnerabilityStatuses(prev => ({
        ...prev,
        [vulnId]: newStatus
      }));

      // שמירה ל-DB - משתמשים ב-ID האמיתי מה-DB
      if (vulnDbId) {
        const response = await axios.put(`/api/vulnerabilities/${vulnDbId}/status`, {
          status: newStatus
        });

        if (response.data.success) {
          console.log('סטטוס עודכן בהצלחה:', response.data.message);
        } else {
          console.error('שגיאה בעדכון סטטוס:', response.data.message);
        }
      } else {
        console.warn('אין ID של ממצא - לא ניתן לשמור ל-DB');
      }
    } catch (error) {
      console.error('שגיאה בשמירת סטטוס ממצא:', error);
      console.error('פרטי השגיאה:', error.response?.data);
    }
  };

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
      <Container maxWidth="xl" sx={{ py: 3, px: { xs: 1, sm: 2, md: 3 }, position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton 
          onClick={() => navigate('/scans')} 
          size="medium"
          sx={{ color: '#7f8c8d' }}
          aria-label="חזרה לדף הסריקות"
        >
          <ArrowBackIcon />
        </IconButton>
      </Box>

      {/* 3 רובריקות נפרדות */}
      {(() => {
        const handledCount = vulnerabilities.filter(v => 
          vulnerabilityStatuses[v.id || `${v.system_id}-${v.osvdb_id}`] === 'טופל' ||
          vulnerabilityStatuses[v.id || `${v.system_id}-${v.osvdb_id}`] === 'סגור'
        ).length;
        const totalCount = vulnerabilities.length;
        const percentage = totalCount > 0 ? Math.round((handledCount / totalCount) * 100) : 0;
        const criticalCount = vulnerabilities.filter(v => v.severity === 'Critical').length;
        const highCount = vulnerabilities.filter(v => v.severity === 'High').length;
        const mediumCount = vulnerabilities.filter(v => v.severity === 'Medium').length;
        const lowCount = vulnerabilities.filter(v => v.severity === 'Low').length;
        
        return (
          <Grid container spacing={2} sx={{ mb: 3, direction: 'rtl' }}>
            {/* רובריקה 1: שם מערכת וסה"כ ממצאים */}
            <Grid item xs={12} md={4}>
              <Fade in timeout={400}>
                <Box 
                  sx={{ 
                    p: 1.5, 
                    height: '100%',
                    direction: 'rtl',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start'
                  }}
                  role="region"
                  aria-label="פרטי מערכת"
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <ComputerIcon sx={{ fontSize: 32, color: '#3498DB' }} aria-hidden="true" />
                    <Typography variant="h4" fontWeight="bold" sx={{ color: '#2c3e50' }}>
                      {system?.name}
                    </Typography>
                  </Box>

                  {lastScanDate && (
                    <Box display="flex" alignItems="center" gap={1} sx={{ mt: '10px' }}>
                      <ScheduleIcon sx={{ color: '#3498DB', fontSize: 26 }} aria-hidden="true" />
                      <Typography variant="h5" sx={{ color: '#2c3e50', fontWeight: 600 }}>
                        סריקה אחרונה: {new Date(lastScanDate).toLocaleDateString('he-IL', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Fade>
            </Grid>

            {/* רובריקה 2: ממצאים שטופלו וגרף התקדמות */}
            {totalCount > 0 && (
            <Grid item xs={12} md={4}>
              <Fade in timeout={500}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 1.5, 
                    height: '100%',
                    borderRadius: 2,
                    border: '1px solid rgba(52, 152, 219, 0.2)',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    direction: 'rtl',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}
                  role="region"
                  aria-label="התקדמות טיפול"
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CheckCircleIcon sx={{ fontSize: 22, color: '#27ae60' }} aria-hidden="true" />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#2c3e50' }}>
                      {totalCount} / {handledCount}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#34495e' }}>
                      ממצאים שטופלו
                    </Typography>
                  </Box>

                  {totalCount > 0 && (
                    <>
                      <Box sx={{ mb: 0.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#34495e', fontWeight: 600 }}>
                            התקדמות הטיפול
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#2c3e50' }}>
                            {percentage}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={percentage}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: 'rgba(170, 10, 33, 0.1)',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 4,
                              background: percentage === 100 
                                ? 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)'
                                : 'linear-gradient(135deg, #3498db 0%, #55c6c2 100%)'
                            }
                          }}
                          aria-label={`התקדמות הטיפול: ${percentage}%`}
                        />
                      </Box>

                    </>
                  )}
                </Paper>
              </Fade>
            </Grid>
            )}

            {/* רובריקה 3: ממצאים קריטיים וגבוהים */}
            {totalCount > 0 && (
            <Grid item xs={12} md={4}>
              <Fade in timeout={600}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 1, 
                    height: '100%',
                    borderRadius: 2,
                    border: '1px solid rgba(52, 152, 219, 0.2)',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    direction: 'rtl',
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 1
                  }}
                  role="region"
                  aria-label="פירוט ממצאים לפי רמת חומרה"
                >
                  {/* ממצאים קריטיים */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    gap: 0.3,
                    p: 1,
                    borderRadius: 1.5,
                    backgroundColor: 'rgba(170, 10, 33, 0.08)',
                    border: '1px solid rgba(170, 10, 33, 0.2)',
                    flex: 1
                  }}>
                    <ErrorIcon sx={{ fontSize: 24, color: '#aa0a21' }} aria-hidden="true" />
                    <Typography variant="caption" sx={{ color: '#7f8c8d', fontWeight: 600, fontSize: '0.65rem' }}>
                      קריטיות
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#aa0a21' }}>
                      {criticalCount}
                    </Typography>
                  </Box>

                  {/* ממצאים גבוהים */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    gap: 0.3,
                    p: 1,
                    borderRadius: 1.5,
                    backgroundColor: 'rgba(247, 60, 87, 0.08)',
                    border: '1px solid rgba(247, 60, 87, 0.2)',
                    flex: 1
                  }}>
                    <WarningIcon sx={{ fontSize: 24, color: '#f73c57' }} aria-hidden="true" />
                    <Typography variant="caption" sx={{ color: '#7f8c8d', fontWeight: 600, fontSize: '0.65rem' }}>
                      גבוהות
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f73c57' }}>
                      {highCount}
                    </Typography>
                  </Box>

                  {/* ממצאים בינוניים */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    gap: 0.3,
                    p: 1,
                    borderRadius: 1.5,
                    backgroundColor: 'rgba(247, 127, 60, 0.08)',
                    border: '1px solid rgba(247, 127, 60, 0.2)',
                    flex: 1
                  }}>
                    <InfoIcon sx={{ fontSize: 24, color: '#f77f3c' }} aria-hidden="true" />
                    <Typography variant="caption" sx={{ color: '#7f8c8d', fontWeight: 600, fontSize: '0.65rem' }}>
                      בינוניות
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f77f3c' }}>
                      {mediumCount}
                    </Typography>
                  </Box>

                  {/* ממצאים נמוכים */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    gap: 0.3,
                    p: 1,
                    borderRadius: 1.5,
                    backgroundColor: 'rgba(255, 173, 0, 0.08)',
                    border: '1px solid rgba(255, 173, 0, 0.2)',
                    flex: 1
                  }}>
                    <CheckCircleIcon sx={{ fontSize: 24, color: '#ffad00' }} aria-hidden="true" />
                    <Typography variant="caption" sx={{ color: '#7f8c8d', fontWeight: 600, fontSize: '0.65rem' }}>
                      נמוכות
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffad00' }}>
                      {lowCount}
                    </Typography>
                  </Box>
                </Paper>
              </Fade>
            </Grid>
            )}
          </Grid>
        );
      })()}

      {vulnerabilities.length === 0 ? (
        <Card sx={{
          backgroundColor: 'rgba(44, 62, 80, 0.4)', // Dark blue-gray
          borderRadius: '12px',
          border: '1px solid rgba(231, 76, 60, 0.3)',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)'
         }}>
          <CardContent>
            <Box textAlign="center" py={4}>
             <ErrorIcon sx={{ fontSize: 80, color: '#E74C3C', mb: 2 }} /> 
             <Typography variant="h6" sx={{ color: '#2c3e50' }}>
                סריקה נכשלה
              </Typography>
             <Typography variant="body2" sx={{ color: '#7f8c8d' }}> 
                לא התקבלו תוצאות מהסריקה
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Paper 
          elevation={0}
          sx={{
            borderRadius: 3,
            border: '1px solid rgba(52, 152, 219, 0.2)',
            overflow: 'hidden'
          }}
        >
          <Table aria-label="טבלת ממצאים של מערכת" sx={{ direction: 'rtl', tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'rgb(98, 120, 141)' }}>
                <TableCell 
                  align="right"
                  sx={{ 
                    fontWeight: 700, 
                    color: '#ffffff', 
                    fontSize: '0.95rem',
                    backgroundColor: 'rgb(98, 120, 141)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    width: '120px'
                  }}
                >
                  חומרה
                </TableCell>
                <TableCell 
                  align="right"
                  sx={{ 
                    fontWeight: 700, 
                    color: '#ffffff', 
                    fontSize: '0.95rem',
                    backgroundColor: 'rgb(98, 120, 141)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    width: 'auto'
                  }}
                >
                  תיאור
                </TableCell>
                <TableCell 
                  align="right"
                  sx={{ 
                    fontWeight: 700, 
                    color: '#ffffff', 
                    fontSize: '0.95rem',
                    backgroundColor: 'rgb(98, 120, 141)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    width: '200px'
                  }}
                >
                  המלצה לטיפול
                </TableCell>
                <TableCell 
                  align="right"
                  sx={{ 
                    fontWeight: 700, 
                    color: '#ffffff', 
                    fontSize: '0.95rem',
                    backgroundColor: 'rgb(98, 120, 141)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    width: '150px'
                  }}
                >
                  סטטוס
                </TableCell>
                <TableCell 
                  align="center"
                  sx={{ 
                    fontWeight: 700, 
                    color: '#ffffff', 
                    fontSize: '0.95rem',
                    backgroundColor: 'rgb(98, 120, 141)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    width: '100px'
                  }}
                >
                  פעולות
                </TableCell>
              </TableRow>
            </TableHead>
          </Table>
          <Box
            sx={{
              maxHeight: 540,
              overflow: 'auto',
              direction: 'rtl',
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px'
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'rgba(52, 152, 219, 0.05)',
                borderRadius: '4px'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(52, 152, 219, 0.3)',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor: 'rgba(52, 152, 219, 0.5)'
                }
              },
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(52, 152, 219, 0.3) rgba(52, 152, 219, 0.05)'
            }}
          >
            <Table aria-label="טבלת ממצאים של מערכת - תוכן" sx={{ direction: 'rtl', tableLayout: 'fixed', width: '100%' }}>
            <TableBody>
              {vulnerabilities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: '#7f8c8d' }}>
                    <ErrorIcon sx={{ fontSize: 48, color: '#E74C3C', mb: 2, opacity: 0.7 }} aria-hidden="true" />
                    <Typography variant="h6" sx={{ color: '#2c3e50', fontWeight: 600 }}>סריקה נכשלה</Typography>
                    <Typography variant="body2" sx={{ color: '#7f8c8d', mt: 1 }}>לא התקבלו תוצאות מהסריקה</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                vulnerabilities.map((vuln) => {
                  const currentStatus = vulnerabilityStatuses[vuln.id || `${vuln.system_id}-${vuln.osvdb_id}`] || 'בטיפול';
                  const isHandled = currentStatus === 'טופל' || currentStatus === 'סגור';
                  
                  return (
                    <TableRow 
                      key={vuln.id || `${vuln.system_id}-${vuln.osvdb_id}`}
                      sx={{
                        backgroundColor: '#ffffff',
                        transition: 'all 0.2s ease',
                        borderBottom: '1px solid rgba(52, 152, 219, 0.1)',
                        '&:hover': { 
                          backgroundColor: '#7f8c8d',
                          '& .MuiTableCell-root': {
                            color: '#ffffff'
                          },
                          '& .MuiTypography-root': {
                            color: '#ffffff !important'
                          },
                          '& .MuiIconButton-root': {
                            color: '#ffffff'
                          }
                        },
                      }}
                    >
                      <TableCell align="right" sx={{ width: '120px', py: 2 }}>
                        <Box sx={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          px: 2,
                          py: 0.75,
                          borderRadius: 2,
                          bgcolor: `${getSeverityColor(vuln.severity)}15`,
                          border: `2px solid ${getSeverityColor(vuln.severity)}50`
                        }}>
                          <Typography variant="body2" sx={{ 
                            color: getSeverityColor(vuln.severity),
                            fontWeight: 600,
                            fontSize: '0.85rem'
                          }}>
                            {vuln.severity || 'לא ידוע'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#2c3e50', width: 'auto' }}>
                        <Typography variant="body2" sx={{
                          direction: 'rtl',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: '#2c3e50',
                          fontWeight: 500
                        }}>
                          {vuln.description || 'אין תיאור'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#2c3e50', width: '200px' }}>
                        {vuln.recommendations ? (
                          <Typography 
                            variant="body2" 
                            component="a"
                            href={vuln.recommendations.startsWith('http') ? vuln.recommendations : `https://${vuln.recommendations}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              direction: 'ltr',
                              textAlign: 'left',
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: '#3498DB',
                              fontWeight: 500,
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              '&:hover': {
                                color: '#2980b9'
                              }
                            }}>
                            {vuln.recommendations}
                          </Typography>
                        ) : (
                          <Typography variant="body2" sx={{ color: '#7f8c8d' }}>
                            אין המלצה
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ width: '150px' }}>
                        <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={currentStatus}
                            onChange={(e) => handleStatusChange(
                              vuln.id || `${vuln.system_id}-${vuln.osvdb_id}`,
                              e.target.value,
                              vuln.id
                            )}
                            aria-label="שינוי סטטוס ממצא"
                            sx={{
                              color: isHandled ? '#1e8449' : '#2c3e50',
                              fontWeight: 600,
                              '.MuiOutlinedInput-notchedOutline': { 
                                borderColor: isHandled ? 'rgba(46, 204, 113, 0.5)' : 'rgba(52, 152, 219, 0.5)' 
                              },
                              '&:hover .MuiOutlinedInput-notchedOutline': { 
                                borderColor: isHandled ? '#27ae60' : '#3498DB' 
                              },
                              '.MuiSvgIcon-root': { color: '#2c3e50' },
                              backgroundColor: isHandled ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255, 255, 255, 0.9)',
                            }}
                          >
                            <MenuItem value="בטיפול">בטיפול</MenuItem>
                            <MenuItem value="טופל">טופל</MenuItem>
                            <MenuItem value="התעלם">התעלם</MenuItem>
                            <MenuItem value="סגור">סגור</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell align="center" sx={{ width: '100px' }}>
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDialog(vuln)}
                          sx={{ color: '#3498DB' }}
                          aria-label="הצג פרטים מלאים"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </Box>
        </Paper>
      )}

      {/* Modal for vulnerability details */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 3,
            border: '1px solid rgba(52, 152, 219, 0.3)',
            backgroundColor: '#ffffff'
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: 'rgb(98, 120, 141)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          direction: 'rtl',
          textAlign: 'right'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            פרטי ממצא מלאים
          </Typography>
          <IconButton 
            onClick={handleCloseDialog}
            sx={{ color: 'white' }}
            aria-label="סגור חלון"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, direction: 'rtl', textAlign: 'right', backgroundColor: '#ffffff' }}>
          {selectedVulnerability && (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#2c3e50', mb: 1 }}>
                  רמת חומרה:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getSeverityIcon(selectedVulnerability.severity)}
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: getSeverityColor(selectedVulnerability.severity),
                      fontWeight: 'bold'
                    }}
                  >
                    {selectedVulnerability.severity || 'לא ידוע'}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#2c3e50', mb: 1 }}>
                  תיאור מלא:
                </Typography>
                <Paper sx={{ 
                  p: 2, 
                  bgcolor: '#f8f9fa',
                  border: '1px solid rgba(52, 152, 219, 0.2)',
                  borderRadius: 2
                }}>
                  <Typography variant="body1" sx={{ 
                    color: '#2c3e50',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.8
                  }}>
                    {selectedVulnerability.description || 'אין תיאור'}
                  </Typography>
                </Paper>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#2c3e50', mb: 1 }}>
                  המלצה לטיפול:
                </Typography>
                <Paper sx={{ 
                  p: 2, 
                  bgcolor: '#f8f9fa',
                  border: '1px solid rgba(52, 152, 219, 0.2)',
                  borderRadius: 2
                }}>
                  {selectedVulnerability.recommendations ? (
                    <Typography 
                      variant="body1" 
                      component="a"
                      href={selectedVulnerability.recommendations.startsWith('http') ? selectedVulnerability.recommendations : `https://${selectedVulnerability.recommendations}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ 
                        color: '#3498DB',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        wordBreak: 'break-word',
                        display: 'block',
                        '&:hover': {
                          color: '#2980b9'
                        }
                      }}
                    >
                      {selectedVulnerability.recommendations}
                    </Typography>
                  ) : (
                    <Typography variant="body1" sx={{ color: '#7f8c8d' }}>
                      אין המלצה
                    </Typography>
                  )}
                </Paper>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#2c3e50', mb: 1 }}>
                  סטטוס טיפול:
                </Typography>
                <FormControl fullWidth variant="outlined" size="medium">
                  <Select
                    value={vulnerabilityStatuses[selectedVulnerability.id || `${selectedVulnerability.system_id}-${selectedVulnerability.osvdb_id}`] || 'בטיפול'}
                    onChange={(e) => handleStatusChange(
                      selectedVulnerability.id || `${selectedVulnerability.system_id}-${selectedVulnerability.osvdb_id}`,
                      e.target.value,
                      selectedVulnerability.id
                    )}
                    aria-label="שינוי סטטוס ממצא"
                    sx={{
                      color: (vulnerabilityStatuses[selectedVulnerability.id || `${selectedVulnerability.system_id}-${selectedVulnerability.osvdb_id}`] === 'טופל' || 
                             vulnerabilityStatuses[selectedVulnerability.id || `${selectedVulnerability.system_id}-${selectedVulnerability.osvdb_id}`] === 'סגור') 
                        ? '#1e8449' : '#2c3e50',
                      fontWeight: 600,
                      '.MuiOutlinedInput-notchedOutline': { 
                        borderColor: (vulnerabilityStatuses[selectedVulnerability.id || `${selectedVulnerability.system_id}-${selectedVulnerability.osvdb_id}`] === 'טופל' || 
                                     vulnerabilityStatuses[selectedVulnerability.id || `${selectedVulnerability.system_id}-${selectedVulnerability.osvdb_id}`] === 'סגור')
                          ? 'rgba(46, 204, 113, 0.5)' : 'rgba(52, 152, 219, 0.5)' 
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': { 
                        borderColor: (vulnerabilityStatuses[selectedVulnerability.id || `${selectedVulnerability.system_id}-${selectedVulnerability.osvdb_id}`] === 'טופל' || 
                                     vulnerabilityStatuses[selectedVulnerability.id || `${selectedVulnerability.system_id}-${selectedVulnerability.osvdb_id}`] === 'סגור')
                          ? '#27ae60' : '#3498DB' 
                      },
                      '.MuiSvgIcon-root': { color: '#2c3e50' },
                      backgroundColor: (vulnerabilityStatuses[selectedVulnerability.id || `${selectedVulnerability.system_id}-${selectedVulnerability.osvdb_id}`] === 'טופל' || 
                                       vulnerabilityStatuses[selectedVulnerability.id || `${selectedVulnerability.system_id}-${selectedVulnerability.osvdb_id}`] === 'סגור')
                        ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255, 255, 255, 0.9)',
                    }}
                  >
                    <MenuItem value="בטיפול">בטיפול</MenuItem>
                    <MenuItem value="טופל">טופל</MenuItem>
                    <MenuItem value="התעלם">התעלם</MenuItem>
                    <MenuItem value="סגור">סגור</MenuItem>
                  </Select>
                </FormControl>
              </Box>

            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, direction: 'rtl', backgroundColor: '#ffffff' }}>
          <Button 
            onClick={handleCloseDialog}
            variant="contained"
            aria-label="סגור חלון פרטי ממצא"
            sx={{
              backgroundColor: 'rgb(98, 120, 141)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgb(78, 100, 121)',
              }
            }}
          >
            סגור
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
     </Box>
  );
}

export default SystemPageNew;