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
  Logout as LogoutIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import {
  APP_ACCENT_LIGHT,
  APP_ACCENT_SURFACE,
  APP_BACKGROUND_DEFAULT,
  APP_BACKGROUND_PAPER,
  APP_BORDER_BLUE_SOFT,
  APP_PRIMARY_BLUE,
  APP_TEXT_PRIMARY,
  APP_TEXT_SECONDARY,
} from '../themeTokens';

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
          background: `linear-gradient(180deg, ${APP_BACKGROUND_PAPER} 0%, ${APP_BACKGROUND_DEFAULT} 100%)`,
          borderBottom: `1px solid ${APP_BORDER_BLUE_SOFT}`,
          boxShadow: '0 1px 0 rgba(15, 23, 42, 0.06)',
          borderRadius: 0,
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
                color: APP_PRIMARY_BLUE,
                filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.35))',
                animation: 'pulse 2s infinite'
              }} />
              <Box>
                <Typography 
                  variant="h6" 
                  component="div" 
                  sx={{ 
                    fontWeight: 'bold',
                    fontSize: '1.5rem',
                    color: APP_TEXT_PRIMARY,
                    lineHeight: 1.2
                  }}
                >
                  PT Service
                </Typography>
                <Typography 
                  variant="caption" 
                  component="div" 
                  sx={{ 
                    color: APP_TEXT_SECONDARY,
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
                  color: APP_PRIMARY_BLUE,
                  backgroundColor: APP_ACCENT_SURFACE,
                  border: `1px solid ${APP_BORDER_BLUE_SOFT}`,
                  textTransform: 'none',
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: APP_ACCENT_LIGHT,
                    borderColor: APP_PRIMARY_BLUE,
                    boxShadow: `0 0 0 1px rgba(168, 85, 247, 0.2)`,
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
                      backgroundColor: APP_BACKGROUND_PAPER,
                      color: APP_TEXT_PRIMARY,
                      border: `1px solid ${APP_BORDER_BLUE_SOFT}`,
                      '&:hover': {
                        backgroundColor: APP_BACKGROUND_DEFAULT,
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
                        backgroundColor: '#ffffff',
                        border: `1px solid ${APP_BORDER_BLUE_SOFT}`,
                        borderRadius: 2,
                        mt: 1,
                        minWidth: 200,
                        boxShadow: '0 10px 40px rgba(15, 23, 42, 0.1)',
                      }
                    }}
                  >
                    <Box sx={{ px: 2, py: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                        {user.full_name || user.username}
                      </Typography>
                      <Typography variant="body2" sx={{ color: APP_TEXT_SECONDARY }}>
                        {user.email}
                      </Typography>
                    </Box>
                    <Divider sx={{ borderColor: APP_BORDER_BLUE_SOFT }} />
                    <MenuItem 
                      onClick={handleLogout}
                      sx={{ 
                        color: APP_TEXT_PRIMARY,
                        '&:hover': {
                          backgroundColor: 'rgba(220, 38, 38, 0.06)'
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
