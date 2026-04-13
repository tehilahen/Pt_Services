import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Box, 
  Button,
  Container, 
  Typography, 
  Grid, 
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fade,
  IconButton,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow
} from '@mui/material';
import { 
  ReportProblem as ReportProblemIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import axios from 'axios';

function LowVulnerabilitiesPage({ user }) {
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
    fetchLowVulnerabilities();
  }, [user]);

  const fetchLowVulnerabilities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/vulnerabilities', {
        headers: {
          'X-User-ID': user?.user_id?.toString() || '',
          'X-User-Type-ID': user?.user_type_id?.toString() || ''
        }
      });
      const allVulns = response.data.vulnerabilities || [];
      const lowVulns = allVulns.filter(vuln => 
        vuln.severity && vuln.severity.toLowerCase() === 'low'
      );
      setVulnerabilities(lowVulns);
      
    } catch (err) {
      console.error('שגיאה בשליפת ממצאים נמוכים:', err);
      setError('שגיאה בטעינת הנתונים');
      setVulnerabilities([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} 
        sx={{
          color: '#2ECC71', // Green for low loading indicator
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
          }
        }} 
        />
        <Typography variant="h6" sx={{ mt: 2, color: '#ECF0F1' }}>טוען ממצאים נמוכים...</Typography>
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
          {/* כותרת */}
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
              <ReportProblemIcon sx={{ 
                fontSize: 48, 
                color: '#ffad00', // Yellow-orange from home page
                mr: 2,
                filter: 'drop-shadow(0 0 8px rgba(255, 173, 0, 0.3))' // Yellow-orange shadow
              }} />
              <Typography 
                variant="h3" 
                component="h1" 
                sx={{
                  fontWeight: 800,
                  color: '#ffad00', // Yellow-orange from home page
                  textShadow: '0 2px 4px rgba(255, 173, 0, 0.3)',
                }}
              >
                ממצאים נמוכים
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ 
                color: '#34495e',
                maxWidth: 600, 
                mx: 'auto' 
                }}>
              ממצאים אלו הם בעלי סיכון נמוך אך עדיין מומלץ לטפל בהם
            </Typography>
          </Box>

          {/* רשימת ממצאים */}
          {vulnerabilities.length === 0 ? (
            <Paper elevation={3} sx={{
              p: 6,
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(255, 173, 0, 0.3)',
              borderRadius: '12px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
            }}>
              <ReportProblemIcon sx={{ fontSize: 48, color: '#ffad00', mb: 2, opacity: 0.7 }} />
              <Typography variant="h6" sx={{ color: '#2c3e50', fontWeight: 600 }}>
                אין ממצאים נמוכים כרגע
              </Typography>
              <Typography variant="body2" sx={{ color: '#34495e', mt: 1 }}>
                זה מצוין! המערכות שלך בטוחות לחלוטין
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{
              background: '#ffffff',
              border: '1px solid #e0e0e0',
              borderRadius: '16px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              maxHeight: 600,
              direction: 'rtl',
              overflow: 'auto',
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
            }}>
              <Table stickyHeader aria-label="low vulnerabilities table" sx={{ direction: 'rtl' }}>
                <TableHead>
                  <TableRow>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2 }}>מערכת</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#ffffff', backgroundColor: '#3498DB', borderBottom: 'none', fontSize: '0.95rem', py: 2 }}>תיאור</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vulnerabilities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ textAlign: 'center', py: 4, color: '#34495e' }}>
                        <ReportProblemIcon sx={{ fontSize: 48, color: '#ffad00', mb: 2, opacity: 0.7 }} />
                        <Typography variant="h6" sx={{ color: '#2c3e50', fontWeight: 600 }}>אין ממצאים נמוכים כרגע</Typography>
                        <Typography variant="body2" sx={{ color: '#34495e', mt: 1 }}>זה מצוין! המערכות שלך בטוחות לחלוטין</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    vulnerabilities.map((vuln, index) => (
                      <TableRow 
                        key={`${vuln.system_id}-${vuln.osvdb_id}-${index}`}
                        sx={{
                          backgroundColor: '#ffffff',
                          '&:hover': { backgroundColor: '#f5f8ff' },
                          borderBottom: '1px solid #f0f0f0',
                          transition: 'background-color 0.2s ease'
                        }}
                      >
                        <TableCell component="th" scope="row" align="right">
                          <Link to={`/system/${vuln.system_id}`} style={{ textDecoration: 'none', color: '#3498DB', fontWeight: 'bold' }}>
                            {vuln.system_name}
                          </Link>
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#000000', maxWidth: '500px' }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Typography variant="body2" sx={{
                              direction: 'rtl',
                              textAlign: 'right',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              lineHeight: 1.6,
                              flex: 1,
                              maxHeight: '80px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: '#000000'
                            }}>
                              {vuln.description || 'אין תיאור'}
                            </Typography>
                            <IconButton 
                              size="small" 
                              onClick={() => handleOpenDialog(vuln)}
                              sx={{ color: '#3498DB', mt: -0.5 }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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
            borderRadius: 3,
            border: '1px solid rgba(255, 173, 0, 0.3)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #ffad00 0%, #ffc233 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          direction: 'rtl',
          textAlign: 'right'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            פרטי ממצא בחומרה נמוכה
          </Typography>
          <IconButton 
            onClick={handleCloseDialog}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, direction: 'rtl', textAlign: 'right' }}>
          {selectedVulnerability && (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#7f8c8d', mb: 1 }}>
                  מערכת:
                </Typography>
                <Typography variant="body1" sx={{ color: '#2c3e50' }}>
                  {selectedVulnerability.system_name || `מערכת ${selectedVulnerability.system_id}`}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#7f8c8d', mb: 1 }}>
                  רמת חומרה:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ReportProblemIcon sx={{ color: '#ffad00' }} />
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: '#ffad00',
                      fontWeight: 'bold'
                    }}
                  >
                    נמוכה
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#7f8c8d', mb: 1 }}>
                  תיאור מלא:
                </Typography>
                <Paper sx={{ 
                  p: 2, 
                  bgcolor: '#f8f9fa',
                  border: '1px solid rgba(255, 173, 0, 0.2)',
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

            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, direction: 'rtl' }}>
          <Button 
            onClick={handleCloseDialog}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #ffad00 0%, #ffc233 100%)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(135deg, #e59d00 0%, #e5b023 100%)',
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

export default LowVulnerabilitiesPage; 