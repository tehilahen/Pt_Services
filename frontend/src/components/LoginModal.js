import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  IconButton,
  InputAdornment,
  CircularProgress,
  Link
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import {
  APP_ACCENT_GLOW_STRONG,
  APP_PRIMARY_BLUE,
  APP_PRIMARY_BLUE_DARK,
} from '../themeTokens';

function LoginModal({ open, onClose, onLogin, mandatory = false }) {
  const [mode, setMode] = useState('login'); // 'login', 'forgot', 'reset'
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    resetToken: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear messages when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (mode === 'login') {
      await handleLogin();
    } else if (mode === 'forgot') {
      await handleForgotPassword();
    } else if (mode === 'reset') {
      await handleResetPassword();
    }
  };

  const handleLogin = async () => {
    if (!formData.username || !formData.password) {
      setError('יש למלא את כל השדות');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        })
      });

      const data = await response.json();

      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.user);
        if (!mandatory) {
          onClose();
        }
        
        // Reset form
        setFormData({ username: '', password: '', email: '', resetToken: '', newPassword: '', confirmPassword: '' });
      } else {
        setError(data.message || 'שגיאה בהתחברות');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('שגיאה בהתחברות לשרת');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError('יש להזין כתובת אימייל');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('קוד איפוס נשלח לכתובת האימייל שלך. אנא בדוק את תיבת הדואר הנכנס.');
        // עבור אוטומטית למסך איפוס סיסמא
        setTimeout(() => {
          setMode('reset');
          setSuccess('');
        }, 3000);
      } else {
        setError(data.message || 'שגיאה בשליחת איפוס סיסמא');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('שגיאה בהתחברות לשרת');
    } finally {
      setLoading(false);
    }
  };

  const validatePasswordStrength = (password) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/]/.test(password)
    };

    const errors = [];
    if (!requirements.length) errors.push('לפחות 8 תווים');
    if (!requirements.uppercase) errors.push('אות גדולה באנגלית (A-Z)');
    if (!requirements.lowercase) errors.push('אות קטנה באנגלית (a-z)');
    if (!requirements.number) errors.push('ספרה (0-9)');
    if (!requirements.special) errors.push('תו מיוחד (!@#$%^&* וכו\')');

    return {
      isValid: Object.values(requirements).every(r => r),
      errors,
      requirements
    };
  };

  const handleResetPassword = async () => {
    if (!formData.resetToken || !formData.newPassword || !formData.confirmPassword) {
      setError('יש למלא את כל השדות');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('הסיסמאות אינן זהות');
      return;
    }

    // בדיקת חוזק סיסמה
    const validation = validatePasswordStrength(formData.newPassword);
    if (!validation.isValid) {
      setError('הסיסמה חייבת לכלול:\n• ' + validation.errors.join('\n• '));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: formData.resetToken,
          newPassword: formData.newPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('הסיסמא שונתה בהצלחה! ניתן כעת להתחבר');
        setTimeout(() => {
          setMode('login');
          setSuccess('');
          setFormData({ username: '', password: '', email: '', resetToken: '', newPassword: '', confirmPassword: '' });
        }, 2000);
      } else {
        setError(data.message || 'שגיאה באיפוס הסיסמא');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setError('שגיאה בהתחברות לשרת');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!mandatory) {
      setFormData({ username: '', password: '', email: '', resetToken: '', newPassword: '', confirmPassword: '' });
      setError('');
      setSuccess('');
      setShowPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setMode('login');
      onClose();
    }
  };

  const switchToMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
  };

  const renderLoginForm = () => (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          name="username"
          label="שם משתמש"
          value={formData.username}
          onChange={handleInputChange}
          fullWidth
          required
          disabled={loading}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 2,
              '& fieldset': {
                borderColor: 'rgba(168, 85, 247, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(168, 85, 247, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
              '& .MuiOutlinedInput-notchedOutline legend': {
                display: 'none',
              },
            },
            '& .MuiInputLabel-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              right: 14,
              left: 'auto',
              transformOrigin: 'top right',
              display: 'flex',
              flexDirection: 'row-reverse',
              alignItems: 'center',
              '& .MuiInputLabel-asterisk': {
                marginLeft: '4px',
                marginRight: 0,
              },
            },
            '& .MuiInputLabel-shrink': {
              transform: 'translate(0, -24px) scale(0.75)',
            },
            '& .MuiOutlinedInput-input': {
              color: 'white',
              textAlign: 'right',
            },
          }}
        />

        <TextField
          name="password"
          label="סיסמה"
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
          onChange={handleInputChange}
          fullWidth
          required
          disabled={loading}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 2,
              '& fieldset': {
                borderColor: 'rgba(168, 85, 247, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(168, 85, 247, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
              '& .MuiOutlinedInput-notchedOutline legend': {
                display: 'none',
              },
            },
            '& .MuiInputLabel-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              right: 14,
              left: 'auto',
              transformOrigin: 'top right',
              display: 'flex',
              flexDirection: 'row-reverse',
              alignItems: 'center',
              '& .MuiInputLabel-asterisk': {
                marginLeft: '4px',
                marginRight: 0,
              },
            },
            '& .MuiInputLabel-shrink': {
              transform: 'translate(0, -24px) scale(0.75)',
            },
            '& .MuiOutlinedInput-input': {
              color: 'white',
              textAlign: 'right',
            },
          }}
        />
      </Box>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Link
          component="button"
          type="button"
          onClick={() => switchToMode('forgot')}
          sx={{
            color: 'primary.main',
            textDecoration: 'none',
            fontSize: '0.875rem',
            '&:hover': {
              textDecoration: 'underline'
            }
          }}
        >
          שכחתי סיסמא
        </Link>
      </Box>
    </>
  );

  const renderForgotForm = () => (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          name="email"
          label="כתובת אימייל"
          type="email"
          value={formData.email}
          onChange={handleInputChange}
          fullWidth
          required
          disabled={loading}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 2,
              '& fieldset': {
                borderColor: 'rgba(168, 85, 247, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(168, 85, 247, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
              '& .MuiOutlinedInput-notchedOutline legend': {
                display: 'none',
              },
            },
            '& .MuiInputLabel-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              right: 14,
              left: 'auto',
              transformOrigin: 'top right',
              display: 'flex',
              flexDirection: 'row-reverse',
              alignItems: 'center',
              '& .MuiInputLabel-asterisk': {
                marginLeft: '4px',
                marginRight: 0,
              },
            },
            '& .MuiInputLabel-shrink': {
              transform: 'translate(0, -24px) scale(0.75)',
            },
            '& .MuiOutlinedInput-input': {
              color: 'white',
              textAlign: 'right',
            },
          }}
        />
      </Box>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Link
          component="button"
          type="button"
          onClick={() => switchToMode('login')}
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            textDecoration: 'none',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            '&:hover': {
              color: 'primary.main'
            }
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          חזור להתחברות
        </Link>
      </Box>
    </>
  );

  const renderResetForm = () => (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          name="resetToken"
          label="קוד איפוס (מהאימייל)"
          value={formData.resetToken}
          onChange={handleInputChange}
          fullWidth
          required
          disabled={loading}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 2,
              '& fieldset': {
                borderColor: 'rgba(168, 85, 247, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(168, 85, 247, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
              '& .MuiOutlinedInput-notchedOutline legend': {
                display: 'none',
              },
            },
            '& .MuiInputLabel-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              right: 14,
              left: 'auto',
              transformOrigin: 'top right',
              display: 'flex',
              flexDirection: 'row-reverse',
              alignItems: 'center',
              '& .MuiInputLabel-asterisk': {
                marginLeft: '4px',
                marginRight: 0,
              },
            },
            '& .MuiInputLabel-shrink': {
              transform: 'translate(0, -24px) scale(0.75)',
            },
            '& .MuiOutlinedInput-input': {
              color: 'white',
              textAlign: 'right',
            },
          }}
        />

        <TextField
          name="newPassword"
          label="סיסמה חדשה"
          type={showNewPassword ? 'text' : 'password'}
          value={formData.newPassword}
          onChange={handleInputChange}
          fullWidth
          required
          disabled={loading}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  edge="end"
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  {showNewPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 2,
              '& fieldset': {
                borderColor: 'rgba(168, 85, 247, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(168, 85, 247, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
              '& .MuiOutlinedInput-notchedOutline legend': {
                display: 'none',
              },
            },
            '& .MuiInputLabel-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              right: 14,
              left: 'auto',
              transformOrigin: 'top right',
              display: 'flex',
              flexDirection: 'row-reverse',
              alignItems: 'center',
              '& .MuiInputLabel-asterisk': {
                marginLeft: '4px',
                marginRight: 0,
              },
            },
            '& .MuiInputLabel-shrink': {
              transform: 'translate(0, -24px) scale(0.75)',
            },
            '& .MuiOutlinedInput-input': {
              color: 'white',
              textAlign: 'right',
            },
          }}
        />

        {/* הצגת דרישות הסיסמה */}
        {formData.newPassword && (
          <Box sx={{ 
            mt: 1, 
            p: 2, 
            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
            borderRadius: 2,
            border: '1px solid rgba(168, 85, 247, 0.3)'
          }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600, display: 'block', mb: 1 }}>
              דרישות הסיסמה:
            </Typography>
            {(() => {
              const validation = validatePasswordStrength(formData.newPassword);
              return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ color: validation.requirements.length ? '#4caf50' : '#f44336', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {validation.requirements.length ? '✓' : '✗'} לפחות 8 תווים
                  </Typography>
                  <Typography variant="caption" sx={{ color: validation.requirements.uppercase ? '#4caf50' : '#f44336', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {validation.requirements.uppercase ? '✓' : '✗'} אות גדולה באנגלית (A-Z)
                  </Typography>
                  <Typography variant="caption" sx={{ color: validation.requirements.lowercase ? '#4caf50' : '#f44336', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {validation.requirements.lowercase ? '✓' : '✗'} אות קטנה באנגלית (a-z)
                  </Typography>
                  <Typography variant="caption" sx={{ color: validation.requirements.number ? '#4caf50' : '#f44336', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {validation.requirements.number ? '✓' : '✗'} ספרה (0-9)
                  </Typography>
                  <Typography variant="caption" sx={{ color: validation.requirements.special ? '#4caf50' : '#f44336', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {validation.requirements.special ? '✓' : '✗'} תו מיוחד (!@#$%^&* וכו')
                  </Typography>
                </Box>
              );
            })()}
          </Box>
        )}

        <TextField
          name="confirmPassword"
          label="אישור סיסמה חדשה"
          type={showConfirmPassword ? 'text' : 'password'}
          value={formData.confirmPassword}
          onChange={handleInputChange}
          fullWidth
          required
          disabled={loading}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  edge="end"
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 2,
              '& fieldset': {
                borderColor: 'rgba(168, 85, 247, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(168, 85, 247, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
              '& .MuiOutlinedInput-notchedOutline legend': {
                display: 'none',
              },
            },
            '& .MuiInputLabel-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              right: 14,
              left: 'auto',
              transformOrigin: 'top right',
              display: 'flex',
              flexDirection: 'row-reverse',
              alignItems: 'center',
              '& .MuiInputLabel-asterisk': {
                marginLeft: '4px',
                marginRight: 0,
              },
            },
            '& .MuiInputLabel-shrink': {
              transform: 'translate(0, -24px) scale(0.75)',
            },
            '& .MuiOutlinedInput-input': {
              color: 'white',
              textAlign: 'right',
            },
          }}
        />
      </Box>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Link
          component="button"
          type="button"
          onClick={() => switchToMode('login')}
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            textDecoration: 'none',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            '&:hover': {
              color: 'primary.main'
            }
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          חזור להתחברות
        </Link>
      </Box>
    </>
  );

  const getTitle = () => {
    switch (mode) {
      case 'forgot':
        return 'איפוס סיסמא';
      case 'reset':
        return 'הגדרת סיסמה חדשה';
      default:
        return 'התחברות למערכת';
    }
  };

  const getSubmitButtonText = () => {
    if (loading) {
      switch (mode) {
        case 'forgot':
          return 'שולח...';
        case 'reset':
          return 'מאפס...';
        default:
          return 'מתחבר...';
      }
    }

    switch (mode) {
      case 'forgot':
        return 'שלח קוד איפוס';
      case 'reset':
        return 'איפוס סיסמא';
      default:
        return 'התחבר';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={mandatory}
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 45%, #0f172a 100%)',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(168, 85, 247, 0.12)',
        }
      }}
    >
      <DialogTitle sx={{ 
        textAlign: 'center', 
        pb: 1,
        position: 'relative'
      }}>
        {!mandatory && (
          <IconButton
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: 'grey.400',
              '&:hover': {
                color: 'grey.200'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <LoginIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
            {getTitle()}
          </Typography>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ px: 4, py: 3 }}>
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                borderRadius: 2,
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                color: '#f44336',
                border: '1px solid rgba(244, 67, 54, 0.3)'
              }}
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert 
              severity="success" 
              sx={{ 
                mb: 3,
                borderRadius: 2,
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                color: '#4caf50',
                border: '1px solid rgba(76, 175, 80, 0.3)'
              }}
            >
              {success}
            </Alert>
          )}

          {mode === 'login' && renderLoginForm()}
          {mode === 'forgot' && renderForgotForm()}
          {mode === 'reset' && renderResetForm()}

        </DialogContent>

        <DialogActions sx={{ px: 4, pb: 4, pt: 2 }}>
          {!mandatory && mode === 'login' && (
            <Button
              onClick={handleClose}
              variant="outlined"
              disabled={loading}
              sx={{
                borderRadius: 2,
                px: 3,
                py: 1.5,
                borderColor: 'rgba(255, 255, 255, 0.3)',
                color: 'rgba(255, 255, 255, 0.8)',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                }
              }}
            >
              ביטול
            </Button>
          )}
          
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.5,
              background: APP_PRIMARY_BLUE,
              backgroundImage: 'none',
              boxShadow: `0 2px 10px ${APP_ACCENT_GLOW_STRONG}`,
              '&:hover': {
                background: APP_PRIMARY_BLUE_DARK,
                backgroundImage: 'none',
                boxShadow: '0 6px 20px rgba(168, 85, 247, 0.35)',
              },
              '&:disabled': {
                background: 'rgba(168, 85, 247, 0.3)',
                color: 'rgba(255, 255, 255, 0.5)',
              }
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} color="inherit" />
                {getSubmitButtonText()}
              </Box>
            ) : (
              getSubmitButtonText()
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default LoginModal; 