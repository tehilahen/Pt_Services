import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  Container,
  Button,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  Divider
} from '@mui/material';
import { 
  Security as SecurityIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Person as PersonIcon
} from '@mui/icons-material';

function Header({ user, onLogout }) {
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  const handleLogout = async () => {
    try {
      // Call logout API
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    onLogout();
    setUserMenuAnchor(null);
  };

  const handleUserMenuOpen = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  return (
    <>
      <AppBar 
        position="static" 
        elevation={0}
        sx={{ 
          background: 'linear-gradient(135deg, #0e2747 0%, #091a33 100%)',
          borderBottom: '1px solid rgba(52, 152, 219, 0.3)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          borderRadius: 0,
          position: 'relative',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar sx={{ 
            justifyContent: 'space-between',
            minHeight: '70px',
            position: 'relative',
            zIndex: 1
          }}>
            {/* PT Service בצד שמאל */}
            <Box 
              component={Link} 
              to="/" 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                textDecoration: 'none', 
                color: 'inherit',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.05)',
                }
              }}
            >
              <SecurityIcon sx={{ 
                mr: 2.5, 
                ml: 1,
                fontSize: 36,
                color: '#3498DB',
                filter: 'drop-shadow(0 2px 4px rgba(52, 152, 219, 0.4))',
                animation: 'pulse 2s infinite'
              }} />
              <Box>
                <Typography 
                  variant="h6" 
                  component="div" 
                  sx={{ 
                    fontWeight: 'bold',
                    fontSize: '1.5rem',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                    color: '#ffffff',
                    lineHeight: 1.2
                  }}
                >
                  PT Service
                </Typography>
                <Typography 
                  variant="caption" 
                  component="div" 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}
                >
                  חטיבת סייבר ותשתיות טכנולוגיות
                </Typography>
              </Box>
            </Box>
            
            {/* כפתורים בצד ימין */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                component={Link}
                to="/request-scan"
                variant="text"
                size="small"
                sx={{
                  px: 2.5,
                  py: 0.9,
                  borderRadius: 2,
                  color: '#ffffff',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(85, 198, 194, 0.6)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                  textTransform: 'none',
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.14)',
                    borderColor: 'rgba(85, 198, 194, 0.8)',
                    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.32)'
                  },
                  '&:active': {
                    transform: 'translateY(0) scale(0.99)'
                  }
                }}
              >
                בקשה לבדיקת מערכת
              </Button>

              {/* User Authentication Section */}
              {user && (
                <>
                  <Chip
                    avatar={<Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main' }}>
                      <PersonIcon sx={{ fontSize: 16 }} />
                    </Avatar>}
                    label={user.full_name || user.username}
                    onClick={handleUserMenuOpen}
                    sx={{
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        cursor: 'pointer'
                      },
                      '& .MuiChip-label': {
                        fontWeight: 600
                      }
                    }}
                  />
                  
                  <Menu
                    anchorEl={userMenuAnchor}
                    open={Boolean(userMenuAnchor)}
                    onClose={handleUserMenuClose}
                    PaperProps={{
                      sx: {
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(59, 166, 212, 0.3)',
                        borderRadius: 2,
                        mt: 1,
                        minWidth: 200
                      }
                    }}
                  >
                    <Box sx={{ px: 2, py: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                        {user.full_name || user.username}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {user.email}
                      </Typography>
                    </Box>
                    <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
                    <MenuItem 
                      onClick={handleLogout}
                      sx={{ 
                        color: 'rgba(255, 255, 255, 0.9)',
                        '&:hover': {
                          backgroundColor: 'rgba(244, 67, 54, 0.1)'
                        }
                      }}
                    >
                      <LogoutIcon sx={{ mr: 2, fontSize: 20 }} />
                      התנתק
                    </MenuItem>
                  </Menu>
                </>
              )}
            </Box>
          </Toolbar>
        </Container>
        
        <style>
          {`
            @keyframes pulse {
              0%, 100% {
                transform: scale(1);
              }
              50% {
                transform: scale(1.1);
              }
            }
          `}
        </style>
      </AppBar>
    </>
  );
}

export default Header;
