import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Alert,
  Box, 
  CircularProgress,
  Container, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Fade,
  Grid, 
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { 
  BugReport as BugIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  ReportProblem as ReportProblemIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import axios from 'axios';

function AllVulnerabilitiesPage({ user }) {
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [selectedVulnerability, setSelectedVulnerability] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenDialog = (vuln) => {
    setSelectedVulnerability(vuln);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedVulnerability(null);
  };

  useEffect(() => {
    fetchVulnerabilities();
  }, [user]);

  const fetchVulnerabilities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/vulnerabilities', {
        headers: {
          'X-User-ID': user?.user_id?.toString() || '',
          'X-User-Type-ID': user?.user_type_id?.toString() || ''
        }
      });
      const vulnerabilitiesData = response.data.vulnerabilities || [];
      setVulnerabilities(vulnerabilitiesData);
      
    } catch (err) {
      console.error('שגיאה בשליפת ממצאים:', err);
      setError('שגיאה בטעינת הנתונים');
      setVulnerabilities([]);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity ? severity.toLowerCase() : '') {
      case 'critical': return '#aa0a21'; // Dark red from home page
      case 'high': return '#f73c57'; // Bright red from home page
      case 'medium': return '#f77f3c'; // Orange from home page
      case 'low': return '#ffad00'; // Yellow-orange from home page
      default: return '#7f8c8d'; // Gray from home page
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity ? severity.toLowerCase() : '') {
      case 'critical': return <ErrorIcon sx={{ color: '#aa0a21' }} />;
      case 'high': return <WarningIcon sx={{ color: '#f73c57' }} />;
      case 'medium': return <WarningIcon sx={{ color: '#f77f3c' }} />;
      case 'low': return <ReportProblemIcon sx={{ color: '#ffad00' }} />;
      default: return <BugIcon sx={{ color: '#7f8c8d' }} />;
    }
  };

  // קיבוץ ממצאים לפי תיאור - כל ממצא יופיע פעם אחת
  const groupedVulnerabilities = useMemo(() => {
    const grouped = {};
    
    vulnerabilities.forEach(vuln => {
      // משתמש בתיאור כמפתח, או osvdb_id אם אין תיאור
      const key = vuln.description || `osvdb_${vuln.osvdb_id || 'unknown'}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          description: vuln.description || 'אין תיאור',
          osvdb_id: vuln.osvdb_id,
          severity: vuln.severity,
          systems: [],
          systemIds: new Set(),
          references: vuln.references || '',
          ref_links: vuln.ref_links || '',
          recommendations: vuln.recommendations || vuln.references || ''
        };
      } else {
        // עדכון שדות מידע שנשמרים ברמת הממצא המרוכז
        if (!grouped[key].references && vuln.references) {
          grouped[key].references = vuln.references;
        }
        if (!grouped[key].ref_links && vuln.ref_links) {
          grouped[key].ref_links = vuln.ref_links;
        }
        if (!grouped[key].recommendations && (vuln.recommendations || vuln.references)) {
          grouped[key].recommendations = vuln.recommendations || vuln.references;
        }
      }
      
      // הוספת מערכת לרשימה אם היא לא קיימת
      if (vuln.system_id && !grouped[key].systemIds.has(vuln.system_id)) {
        grouped[key].systems.push({
          system_id: vuln.system_id,
          system_name: vuln.system_name || `מערכת ${vuln.system_id}`
        });
        grouped[key].systemIds.add(vuln.system_id);
      }
      
      // שמירת החומרה הגבוהה ביותר
      const severityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
      const currentOrder = severityOrder[grouped[key].severity ? grouped[key].severity.toLowerCase() : 'unknown'] || 999;
      const newOrder = severityOrder[vuln.severity ? vuln.severity.toLowerCase() : 'unknown'] || 999;
      if (newOrder < currentOrder) {
        grouped[key].severity = vuln.severity;
      }
    });
    
    return Object.values(grouped).map(item => ({
      ...item,
      systemIds: undefined, // הסרת Set לפני החזרה
      systemCount: item.systems.length
    }));
  }, [vulnerabilities]);

  const filteredVulnerabilities = groupedVulnerabilities.filter(vuln => {
    const matchesSearch = (vuln.description && vuln.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (vuln.osvdb_id && vuln.osvdb_id.toString().includes(searchTerm));
    
    const matchesSeverity = severityFilter === 'all' || (vuln.severity && vuln.severity.toLowerCase() === severityFilter);
    
    return matchesSearch && matchesSeverity;
  });

  // מיון לפי חומרה
  const sortedVulnerabilities = [...filteredVulnerabilities].sort((a, b) => {
    const severityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    const aOrder = severityOrder[a.severity ? a.severity.toLowerCase() : 'unknown'] || 999;
    const bOrder = severityOrder[b.severity ? b.severity.toLowerCase() : 'unknown'] || 999;
    return aOrder - bOrder;
  });

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} 
        sx={{
          color: '#3498DB', // Bright blue for loading indicator
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
          }
        }} 
        />
        <Typography variant="h6" sx={{ mt: 2, color: '#ECF0F1' }}>טוען ממצאים...</Typography>
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
      <Container maxWidth="xl" sx={{ py: 4, position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Fade in timeout={600}>
        <Box>
          {/* חיפוש ופילטרים */}
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            {/* פילטר חומרה */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
              <Paper 
                elevation={0}
                sx={{
                  p: 1,
                  bgcolor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(52, 152, 219, 0.2)',
                  borderRadius: 4,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(52, 152, 219, 0.1)',
                  display: 'inline-flex',
                  gap: 0.5
                }}
              >
                <ToggleButtonGroup
                  value={severityFilter}
                  exclusive
                  onChange={(e, newValue) => newValue && setSeverityFilter(newValue)}
                  sx={{ 

                    gap: 0.5,

                 

                    '& .MuiToggleButton-root': {
                      color: '#2c3e50',

                      border: 'none',
                      borderRadius: 3,
                      px: 3,
                      py: 1.2,
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      textTransform: 'none',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'transparent',
                        transition: 'background 0.3s ease',
                        zIndex: 0
                      },
                      '& > *': {
                        position: 'relative',
                        zIndex: 1
                      },

                

                      '&:hover': {

                        backgroundColor: 'rgba(52, 152, 219, 0.08)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 2px 8px rgba(52, 152, 219, 0.15)'

                     

                      },
                      '&.Mui-selected': {
                        backgroundColor: '#3498DB',
                        color: '#ffffff',

                        boxShadow: '0 4px 12px rgba(52, 152, 219, 0.3)',
                        '&:hover': {

                     
                          backgroundColor: '#2980b9',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 6px 16px rgba(52, 152, 219, 0.4)'
                        },
                        '&::before': {
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 100%)'

                  

                        }
                      }
                    }
                  }}
                >
                  <ToggleButton value="all" sx={{ 
                    '&.Mui-selected': { 
                      backgroundColor: '#3498DB',
                    } 
                  }}>
                    כל הממצאים
                  </ToggleButton>
                  <ToggleButton value="critical" sx={{ 
                    color: '#aa0a21',
                    '& .MuiSvgIcon-root': { color: '#aa0a21' },
                    '&.Mui-selected': { 
                      backgroundColor: '#aa0a21',
                      color: '#ffffff',
                      '& .MuiSvgIcon-root': { color: '#ffffff' },
                      '&:hover': {
                        backgroundColor: '#8a0819'
                      }
                    },
                    '&:hover:not(.Mui-selected)': {
                      backgroundColor: 'rgba(170, 10, 33, 0.15)',
                      color: '#8a0819',
                      '& .MuiSvgIcon-root': { color: '#8a0819' }
                    }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ErrorIcon sx={{ fontSize: 18 }} />
                      קריטי
                    </Box>
                  </ToggleButton>
                  <ToggleButton value="high" sx={{ 
                    color: '#f73c57',
                    '& .MuiSvgIcon-root': { color: '#f73c57' },
                    '&.Mui-selected': { 
                      backgroundColor: '#f73c57',
                      color: '#ffffff',
                      '& .MuiSvgIcon-root': { color: '#ffffff' },
                      '&:hover': {
                        backgroundColor: '#e62a45'
                      }
                    },
                    '&:hover:not(.Mui-selected)': {
                      backgroundColor: 'rgba(247, 60, 87, 0.15)',
                      color: '#e62a45',
                      '& .MuiSvgIcon-root': { color: '#e62a45' }
                    }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <WarningIcon sx={{ fontSize: 18 }} />
                      גבוה
                    </Box>
                  </ToggleButton>
                  <ToggleButton value="medium" sx={{ 
                    color: '#f77f3c',
                    '& .MuiSvgIcon-root': { color: '#f77f3c' },
                    '&.Mui-selected': { 
                      backgroundColor: '#f77f3c',
                      color: '#ffffff',
                      '& .MuiSvgIcon-root': { color: '#ffffff' },
                      '&:hover': {
                        backgroundColor: '#e66d2a'
                      }
                    },
                    '&:hover:not(.Mui-selected)': {
                      backgroundColor: 'rgba(247, 127, 60, 0.15)',
                      color: '#e66d2a',
                      '& .MuiSvgIcon-root': { color: '#e66d2a' }
                    }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <WarningIcon sx={{ fontSize: 18 }} />
                      בינוני
                    </Box>
                  </ToggleButton>
                  <ToggleButton value="low" sx={{ 
                    color: '#cc8a00',
                    '& .MuiSvgIcon-root': { color: '#cc8a00' },
                    '&.Mui-selected': { 
                      backgroundColor: '#ffad00',
                      color: '#2c3e50',
                      '& .MuiSvgIcon-root': { color: '#2c3e50' },
                      '&:hover': {
                        backgroundColor: '#e69a00'
                      }
                    },
                    '&:hover:not(.Mui-selected)': {
                      backgroundColor: 'rgba(255, 173, 0, 0.15)',
                      color: '#b37a00',
                      '& .MuiSvgIcon-root': { color: '#b37a00' }
                    }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ReportProblemIcon sx={{ fontSize: 18, color: '#ffad00' }} />
                      נמוך
                    </Box>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Paper>
            </Box>

            {/* שורת חיפוש */}
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Paper
                elevation={0}
                sx={{
                  maxWidth: 600,
                  width: '100%',
                  bgcolor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(52, 152, 219, 0.2)',
                  borderRadius: 4,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(52, 152, 219, 0.1)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    boxShadow: '0 6px 24px rgba(52, 152, 219, 0.12), 0 0 0 1px rgba(52, 152, 219, 0.2)',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <TextField
                  placeholder="חפש ממצא לפי תיאור או מזהה..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 4,
                      bgcolor: 'transparent',
                      border: 'none',
                      boxShadow: 'none',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: 'none'
                      },
                      '&.Mui-focused': {
                        boxShadow: 'none'
                      },
                      '& .MuiOutlinedInput-input': {
                        color: '#2c3e50',
                        py: 1.5,
                        fontSize: '1rem',
                        fontWeight: 500,
                        '&::placeholder': {
                          color: '#95a5a6',
                          opacity: 1,
                          fontWeight: 400
                        }
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: 'none'
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        border: 'none'
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        border: 'none'
                      }
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ ml: 1 }}>
                        <SearchIcon sx={{ 
                          color: searchTerm ? '#3498DB' : '#95a5a6',
                          transition: 'color 0.3s ease',
                          fontSize: 24
                        }} /> 
                      </InputAdornment>
                    ),
                  }}
                />
              </Paper>
            </Box>
          </Box>

          {/* רשימת ממצאים */}
          {sortedVulnerabilities.length === 0 ? (
            <Paper elevation={3} sx={{
              p: 6,
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(52, 152, 219, 0.2)',
              borderRadius: '12px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
            }}>
              <BugIcon sx={{ fontSize: 48, color: '#3498DB', mb: 2, opacity: 0.7 }} />
              <Typography variant="h6" sx={{ color: '#2c3e50', fontWeight: 600 }}>
                {searchTerm || severityFilter !== 'all' ? 'לא נמצאו ממצאים התואמים לסינון' : 'אין ממצאים במערכת'}
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{
              background: '#ffffff',
              border: '1px solid #e0e0e0',
              borderRadius: '16px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              direction: 'rtl',
              maxHeight: '70vh',
              overflow: 'auto',
              scrollBehavior: 'smooth',
              '&::-webkit-scrollbar': {
                width: '6px',
                height: '6px'
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent'
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '3px'
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: 'rgba(0, 0, 0, 0.3)'
              }
            }}>
              <Table stickyHeader aria-label="all vulnerabilities table" sx={{ direction: 'rtl' }}>
                <TableHead>
                  <TableRow>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2 }}>מערכות</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2 }}>חומרה</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2 }}>תיאור</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2 }}>המלצה לטיפול</TableCell>
                    <TableCell align="center" sx={{ backgroundColor: '#3498DB', borderBottom: 'none', width: '60px', py: 2 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedVulnerabilities.map((vuln, index) => (
                    <TableRow 
                      key={`${vuln.description}-${vuln.osvdb_id}-${index}`}
                      sx={{
                        backgroundColor: '#ffffff',
                        '&:hover': { backgroundColor: '#f5f8ff' },
                        borderBottom: '1px solid #f0f0f0',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <TableCell align="right" sx={{ py: 2 }}>
                        <Box sx={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 2,
                          bgcolor: 'rgba(52, 152, 219, 0.1)',
                          color: '#3498DB',
                          fontWeight: 700,
                          fontSize: '0.9rem'
                        }}>
                          {vuln.systemCount || 0}
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 2 }}>
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
                      <TableCell align="right" sx={{ color: '#2c3e50', maxWidth: '400px', py: 2 }}>
                        <Typography variant="body1" sx={{
                          direction: 'rtl',
                          textAlign: 'right',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          lineHeight: 1.6,
                          maxHeight: '70px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontSize: '0.95rem',
                          fontWeight: 500,
                          color: '#1a252f'
                        }}>
                          {vuln.description || 'אין תיאור'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#2c3e50', maxWidth: '350px', py: 2 }}>
                        {(() => {
                          const text = vuln.recommendations || vuln.references || vuln.ref_links || '';
                          const urlRegex = /(https?:\/\/[^\s]+)/g;
                          const parts = text.split(urlRegex);
                          
                          if (parts.length === 1 && !urlRegex.test(text)) {
                            return (
                              <Typography variant="body2" sx={{
                                direction: 'rtl',
                                textAlign: 'right',
                                lineHeight: 1.6,
                                fontSize: '0.9rem',
                                color: '#546e7a'
                              }}>
                                {text || 'לא קיימת המלצה במערכת'}
                              </Typography>
                            );
                          }
                          
                          return (
                            <Box sx={{ direction: 'rtl', textAlign: 'right' }}>
                              {parts.map((part, i) => {
                                if (urlRegex.test(part)) {
                                  return (
                                    <a 
                                      key={i}
                                      href={part}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        color: '#3498DB',
                                        textDecoration: 'none',
                                        fontWeight: 500,
                                        fontSize: '0.85rem',
                                        wordBreak: 'break-all'
                                      }}
                                      onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                                      onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                                    >
                                      {part.length > 50 ? part.substring(0, 50) + '...' : part}
                                    </a>
                                  );
                                }
                                return (
                                  <Typography key={i} component="span" variant="body2" sx={{ 
                                    fontSize: '0.9rem',
                                    color: '#546e7a'
                                  }}>
                                    {part}
                                  </Typography>
                                );
                              })}
                            </Box>
                          );
                        })()}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDialog(vuln)}
                          sx={{ color: '#3498DB' }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Fade>

      {/* Modal for vulnerability details */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: '16px',
            border: 'none',
            background: '#ffffff',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #3498DB 0%, #2980b9 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          direction: 'rtl',
          textAlign: 'right',
          py: 2.5,
          px: 3
        }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#ffffff' }}>
            פרטי ממצא
          </Typography>
          <IconButton 
            onClick={handleCloseDialog}
            sx={{ 
              color: '#ffffff',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.15)'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ direction: 'rtl', textAlign: 'right', pt: 3, pb: 4, px: 4 }}>
          {selectedVulnerability && (
            <Box>
              {/* חומרה ומספר מערכות */}
              <Grid container spacing={3} sx={{ mt: 0.5, mb: 2.5 }}>
                <Grid item xs={6}>
                  <Box sx={{ 
                    p: 3, 
                    borderRadius: 3, 
                    bgcolor: `${getSeverityColor(selectedVulnerability.severity)}10`,
                    border: `2px solid ${getSeverityColor(selectedVulnerability.severity)}40`,
                    textAlign: 'center'
                  }}>
                    <Typography variant="body2" sx={{ color: '#7f8c8d', mb: 1.5, fontWeight: 600, fontSize: '0.85rem' }}>
                      רמת חומרה
                    </Typography>
                    <Typography 
                      variant="h5" 
                      sx={{ 
                        color: getSeverityColor(selectedVulnerability.severity),
                        fontWeight: 800
                      }}
                    >
                      {selectedVulnerability.severity || 'לא ידוע'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ 
                    p: 3, 
                    borderRadius: 3, 
                    bgcolor: 'rgba(52, 152, 219, 0.08)',
                    border: '2px solid rgba(52, 152, 219, 0.3)',
                    textAlign: 'center'
                  }}>
                    <Typography variant="body2" sx={{ color: '#7f8c8d', mb: 1.5, fontWeight: 600, fontSize: '0.85rem' }}>
                      מספר מערכות מושפעות
                    </Typography>
                    <Typography variant="h5" sx={{ color: '#3498DB', fontWeight: 800 }}>
                      {selectedVulnerability.systemCount || 0}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* מערכות מושפעות */}
              {selectedVulnerability.systems && selectedVulnerability.systems.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a252f', mb: 2, fontSize: '1.1rem' }}>
                    מערכות מושפעות
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    {selectedVulnerability.systems.map((system) => (
                      <Link 
                        key={system.system_id}
                        to={`/system/${system.system_id}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <Paper sx={{ 
                          px: 2.5, 
                          py: 1.2,
                          background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
                          border: '2px solid #3498DB',
                          borderRadius: 2,
                          transition: 'all 0.25s ease',
                          cursor: 'pointer',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #3498DB 0%, #2980b9 100%)',
                            transform: 'translateY(-3px)',
                            boxShadow: '0 6px 20px rgba(52, 152, 219, 0.35)',
                            '& .MuiTypography-root': { color: '#ffffff' }
                          }
                        }}>
                          <Typography variant="body2" sx={{ 
                            color: '#3498DB',
                            fontWeight: 700,
                            transition: 'color 0.25s ease'
                          }}>
                            {system.system_name}
                          </Typography>
                        </Paper>
                      </Link>
                    ))}
                  </Box>
                </Box>
              )}

              {/* תיאור */}
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a252f', mb: 2, fontSize: '1.1rem' }}>
                  תיאור מלא
                </Typography>
                <Paper sx={{ 
                  p: 3, 
                  background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
                  border: '1px solid #e8e8e8',
                  borderRadius: 3,
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)'
                }}>
                  <Typography variant="body1" sx={{ 
                    color: '#2c3e50',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.9,
                    fontSize: '1rem'
                  }}>
                    {selectedVulnerability.description || 'אין תיאור'}
                  </Typography>
                </Paper>
              </Box>

            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          direction: 'rtl',
          background: '#f8f9fa',
          borderTop: '1px solid #e8e8e8'
        }}>
          <Button 
            onClick={handleCloseDialog}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #3498DB 0%, #2980b9 100%)',
              color: 'white',
              px: 5,
              py: 1.3,
              borderRadius: 2,
              fontWeight: 700,
              boxShadow: '0 4px 15px rgba(52, 152, 219, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2980b9 0%, #1f6fa5 100%)',
                boxShadow: '0 6px 20px rgba(52, 152, 219, 0.4)',
                transform: 'translateY(-2px)'
              },
              transition: 'all 0.25s ease-in-out'
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

export default AllVulnerabilitiesPage; 