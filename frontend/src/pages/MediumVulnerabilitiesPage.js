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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { 
  Info as InfoIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import axios from 'axios';
import {
  tableContainerPaperSx,
  tableHeadCellSx,
  tableBodyRowSx,
  tableScrollbarSx,
  tableStickyRtlSx
} from '../tableStyles';

function MediumVulnerabilitiesPage({ user }) {
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
    fetchMediumVulnerabilities();
  }, [user]);

  const fetchMediumVulnerabilities = async () => {
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
      const mediumVulns = allVulns.filter(vuln => 
        vuln.severity && vuln.severity.toLowerCase() === 'medium'
      );
      setVulnerabilities(mediumVulns);
      
    } catch (err) {
      console.error('שגיאה בשליפת ממצאים בינוניים:', err);
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
          color: '#F39C12', // Orange for medium loading indicator
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
          }
        }} 
        />
        <Typography variant="h6" sx={{ mt: 2, color: '#ECF0F1' }}>טוען ממצאים בינוניים...</Typography>
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
          {/* כותרת */}
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
              <InfoIcon sx={{ 
                fontSize: 48, 
                color: '#f77f3c', // Orange from home page
                mr: 2,
                filter: 'drop-shadow(0 0 8px rgba(247, 127, 60, 0.3))' // Orange shadow
              }} />
              <Typography 
                variant="h3" 
                component="h1" 
                sx={{
                  fontWeight: 800,
                  color: '#f77f3c', // Orange from home page
                  textShadow: '0 2px 4px rgba(247, 127, 60, 0.3)',
                }}
              >
                ממצאים בינוניים
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ 
                color: '#34495e',
                maxWidth: 600, 
                mx: 'auto' 
                }}>
              ממצאים אלו דורשים תשומת לב וטיפול בהקדם האפשרי למניעת סיכונים
            </Typography>
          </Box>

          {/* רשימת ממצאים */}
          {vulnerabilities.length === 0 ? (
            <Paper elevation={3} sx={{
              p: 6,
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(247, 127, 60, 0.3)',
              borderRadius: '12px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
            }}>
              <WarningIcon sx={{ fontSize: 48, color: '#f77f3c', mb: 2, opacity: 0.7 }} />
              <Typography variant="h6" sx={{ color: '#2c3e50', fontWeight: 600 }}>
                אין ממצאים בינוניים כרגע
              </Typography>
              <Typography variant="body2" sx={{ color: '#34495e', mt: 1 }}>
                זה מצוין! המערכות שלך בטוחות מממצאים בינוניים
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{
              ...tableContainerPaperSx,
              ...tableScrollbarSx,
              maxHeight: 600,
              overflow: 'auto'
            }}>
              <Table stickyHeader aria-label="medium vulnerabilities table" sx={tableStickyRtlSx}>
                <TableHead>
                  <TableRow>
                    <TableCell align="right" sx={tableHeadCellSx}>מערכת</TableCell>
                    <TableCell align="right" sx={tableHeadCellSx}>תיאור</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vulnerabilities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ textAlign: 'center', py: 4, color: '#34495e' }}>
                        <WarningIcon sx={{ fontSize: 48, color: '#f77f3c', mb: 2, opacity: 0.7 }} />
                        <Typography variant="h6" sx={{ color: '#2c3e50', fontWeight: 600 }}>אין ממצאים בינוניים כרגע</Typography>
                        <Typography variant="body2" sx={{ color: '#34495e', mt: 1 }}>זה מצוין! המערכות שלך בטוחות מממצאים בינוניים</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    vulnerabilities.map((vuln, index) => (
                      <TableRow 
                        key={`${vuln.system_id}-${vuln.osvdb_id}-${index}`}
                        sx={tableBodyRowSx}
                      >
                        <TableCell component="th" scope="row" align="right">
                          <Link to={`/system/${vuln.system_id}`} style={{ textDecoration: 'none', color: '#A855F7', fontWeight: 'bold' }}>
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
                              sx={{ color: '#A855F7', mt: -0.5 }}
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
            border: '1px solid rgba(247, 127, 60, 0.3)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #f77f3c 0%, #ff9f5a 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          direction: 'rtl',
          textAlign: 'right'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            פרטי ממצא בחומרה בינונית
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
                  <WarningIcon sx={{ color: '#f77f3c' }} />
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: '#f77f3c',
                      fontWeight: 'bold'
                    }}
                  >
                    בינונית
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
                  border: '1px solid rgba(247, 127, 60, 0.2)',
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
              background: 'linear-gradient(135deg, #f77f3c 0%, #ff9f5a 100%)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(135deg, #d76f32 0%, #e58f4a 100%)',
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

export default MediumVulnerabilitiesPage; 