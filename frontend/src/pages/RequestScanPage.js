import React, { useState, useEffect } from 'react';
import { Box, Container, TextField, Typography, Button, Grid, Paper, Alert, CircularProgress, Autocomplete } from '@mui/material';
import axios from 'axios';

function RequestScanPage() {
  const [form, setForm] = useState({
    requesterName: '',
    requesterEmail: '',
    requesterPhone: '',
    systemName: '',
    systemUrl: '',
    details: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [systems, setSystems] = useState([]);
  const [loadingSystems, setLoadingSystems] = useState(true);

  useEffect(() => {
    fetchSystems();
  }, []);

  const fetchSystems = async () => {
    try {
      setLoadingSystems(true);
      const response = await axios.get('/api/systems');
      setSystems(response.data.systems || []);
    } catch (err) {
      console.error('שגיאה בשליפת מערכות:', err);
      setError('שגיאה בטעינת רשימת המערכות');
    } finally {
      setLoadingSystems(false);
    }
  };

  const inputBlueSx = {
    '& .MuiInputBase-input': { 
      color: '#1a252f',
      direction: 'rtl',
      textAlign: 'right',
      paddingRight: '16px'
    },
    '& .MuiInputLabel-root': {
      right: 15,
      left: 'auto',
      transformOrigin: 'top right',
      paddingRight: '15px',
      color: '#2c3e50',
      fontWeight: 600,
      '&.Mui-focused': {
        color: '#1a252f'
      }
    },
    '& .MuiOutlinedInput-notchedOutline legend': {
      textAlign: 'right'
    },
    '& .MuiInputBase-input::placeholder': {
      textAlign: 'right',
      paddingRight: '4px',
      opacity: 0.6
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSystemChange = (event, newValue) => {
    if (newValue) {
      setForm((prev) => ({
        ...prev,
        systemName: newValue.name || '',
        systemUrl: newValue.url || ''
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        systemName: '',
        systemUrl: ''
      }));
    }
  };


  const resetForm = () => {
    setForm({
      requesterName: '',
      requesterEmail: '',
      requesterPhone: '',
      systemName: '',
      systemUrl: '',
      details: ''
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.requesterName || !form.systemName) {
      setError('אנא מלא שם פונה ושם מערכת.');
      return;
    }

    try {
      // שליחת הבקשה לשרת
      const response = await fetch('/api/scan-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requesterName: form.requesterName,
          requesterEmail: form.requesterEmail,
          requesterPhone: form.requesterPhone,
          systemName: form.systemName,
          systemUrl: form.systemUrl,
          details: form.details
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        // ניקוי הטופס אחרי שליחה מוצלחת
        setTimeout(() => {
          resetForm();
        }, 2000);
      } else {
        setError(data.message || 'שגיאה בשליחת הבקשה');
      }
    } catch (error) {
      console.error('Error submitting scan request:', error);
      setError('שגיאה בהתחברות לשרת. אנא נסה שנית.');
    }
  };

  return (
    <Box sx={{
      height: 'fit-content',
      display: 'flex',
      flexDirection: 'column',
      background: '#f8f9fa',
      position: 'relative',
      direction: 'rtl',
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
      <Container maxWidth="md" sx={{ py: 4, position: 'relative', zIndex: 1 }}>
        <Typography variant="h4" component="h1" sx={{
          fontWeight: 800,
          textAlign: 'center',
          color: '#2c3e50',
          mb: 3,
          direction: 'rtl'
        }}>
          בקשה לבדיקת מערכת
        </Typography>

        <Paper sx={{ p: 3, background: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(52, 152, 219, 0.3)', borderRadius: 2, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)' }}>
          {error && (
            <Alert severity="warning" sx={{ mb: 2, direction: 'rtl', textAlign: 'right' }}>{error}</Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2, direction: 'rtl', textAlign: 'right' }}>{success}</Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ direction: 'rtl' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="שם הפונה"
                  name="requesterName"
                  value={form.requesterName}
                  onChange={handleChange}
                  required
                  sx={inputBlueSx}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={'דוא"ל הפונה'}
                  name="requesterEmail"
                  type="email"
                  value={form.requesterEmail}
                  onChange={handleChange}
                  sx={inputBlueSx}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="טלפון"
                  name="requesterPhone"
                  value={form.requesterPhone}
                  onChange={handleChange}
                  sx={inputBlueSx}
                />
              </Grid>
                <Grid item xs={12} sm={6}>
                <Autocomplete
                  fullWidth
                  options={systems}
                  getOptionLabel={(option) => option.name || ''}
                  value={systems.find(s => s.name === form.systemName) || null}
                  onChange={handleSystemChange}
                  loading={loadingSystems}
                  disabled={loadingSystems}
                  noOptionsText="אין מערכות זמינות"
                  loadingText="טוען מערכות..."
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="שם המערכת"
                      required
                      sx={{
                        ...inputBlueSx,
                        '& .MuiInputLabel-root': {
                          ...inputBlueSx['& .MuiInputLabel-root'],
                          paddingRight: '25px'
                        }
                      }}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingSystems ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  ListboxProps={{
                    sx: {
                      direction: 'rtl',
                      textAlign: 'right',
                      '& .MuiAutocomplete-option': {
                        direction: 'rtl',
                        textAlign: 'right'
                      }
                    }
                  }}
                  sx={{
                    '& .MuiAutocomplete-inputRoot': {
                      direction: 'rtl',
                      textAlign: 'right'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="כתובת המערכת (URL)"
                  name="systemUrl"
                  value={form.systemUrl}
                  onChange={handleChange}
                  placeholder="https://example.com"
                  sx={{
                    ...inputBlueSx,
                    '& .MuiInputBase-input': {
                      ...inputBlueSx['& .MuiInputBase-input'],
                      paddingRight: '12px'
                    },
                    '& .MuiInputBase-input::placeholder': {
                      textAlign: 'right',
                      paddingRight: '0px',
                      opacity: 0.5,
                      fontStyle: 'italic'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="פרטים נוספים"
                  name="details"
                  value={form.details}
                  onChange={handleChange}
                  multiline
                  minRows={4}
                  placeholder="תאר כל מידע נוסף שיכול לעזור בביצוע הבדיקה..."
                  sx={{
                    ...inputBlueSx,
                    '& .MuiInputBase-input': {
                      ...inputBlueSx['& .MuiInputBase-input'],
                      textAlign: 'right',
                      paddingRight: '12px'
                    },
                    '& .MuiInputBase-input::placeholder': {
                      textAlign: 'right',
                      paddingRight: '0px',
                      opacity: 0.5,
                      fontStyle: 'italic'
                    }
                  }}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Button type="submit" variant="contained" sx={{ px: 4 }}>
                שליחת בקשה במייל
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default RequestScanPage; 