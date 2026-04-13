import React from 'react';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Divider } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import {
  Home as HomeIcon,
  Computer as ComputerIcon,
  Scanner as ScannerIcon,
  BugReport as BugReportIcon,
  AdminPanelSettings as AdminIcon,
  BarChart as BarChartIcon,
  Assignment as AssignmentIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import {
  APP_ACCENT_GLOW,
  APP_ACCENT_LIGHT,
  APP_ACCENT_SURFACE,
  APP_BACKGROUND_DEFAULT,
  APP_BORDER_BLUE_SOFT,
  APP_PRIMARY_BLUE,
  APP_PRIMARY_BLUE_DARK,
  APP_TEXT_PRIMARY,
  APP_TEXT_SECONDARY,
} from '../themeTokens';

const Sidebar = ({ user, onLogout }) => {
  const location = useLocation();

  // Check if user is Admin (UserTypeID = 1) or System Manager (UserTypeID = 2)
  // Note: user_type_id can be number or string depending on how it's stored
  const isAdmin = user?.user_type_id === 1 || user?.user_type_id === '1';
  const isSystemManager = user?.user_type_id === 2 || user?.user_type_id === '2';
  const canSeeCodeReviews = isAdmin || isSystemManager;

  const menuItems = [
    {
      text: 'דף הבית',
      path: '/',
      icon: <HomeIcon />
    },
    {
      text: 'דאשבורד',
      path: '/dashboard',
      icon: <BarChartIcon />
    },
    {
      text: 'מערכות',
      path: '/systems',
      icon: <ComputerIcon />
    },
    {
      text: 'סריקות',
      path: '/scans',
      icon: <ScannerIcon />
    },
    {
      text: 'ממצאים',
      path: '/vulnerabilities',
      icon: <BugReportIcon />
    },
    ...(canSeeCodeReviews ? [{
      text: 'סריקות קוד',
      path: '/code-reviews',
      icon: <CodeIcon />
    }] : [])
  ];

  // Admin menu items - only shown to Admin users
  const adminMenuItems = [
    {
      text: 'ניהול משתמשים',
      path: '/admin/users',
      icon: <AdminIcon />
    },
    {
      text: 'מעקב PT ידני',
      path: '/admin/pt-tracking',
      icon: <AssignmentIcon />
    }
  ];

  return (
    <Box
      sx={{
        width: 280,
        height: '100vh',
        backgroundColor: APP_BACKGROUND_DEFAULT,
        borderRight: `1px solid ${APP_BORDER_BLUE_SOFT}`,
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 32px rgba(15, 23, 42, 0.06)',
      }}
    >
      {/* כותרת */}
      <Box sx={{ 
        p: 3, 
        borderBottom: `1px solid ${APP_BORDER_BLUE_SOFT}`,
        textAlign: 'center'
      }}>
        <Typography variant="h6" sx={{ 
          color: APP_PRIMARY_BLUE,
          fontWeight: 700,
          mb: 1
        }}>
          PT Service
        </Typography>
        <Typography variant="caption" sx={{ 
          color: APP_TEXT_SECONDARY
        }}>
          מערכת לביצוע מבדקי חדירות
        </Typography>
      </Box>

      {/* תפריט */}
      <List sx={{ flex: 1, p: 2 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0, '&:not(:last-child)': { borderBottom: `1px solid ${APP_BORDER_BLUE_SOFT}` } }}>
              <ListItemButton
                component={Link}
                to={item.path}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  px: 2,
                  backgroundColor: isActive ? APP_ACCENT_LIGHT : 'transparent',
                  border: isActive ? `1px solid ${APP_ACCENT_GLOW}` : '1px solid transparent',
                  boxShadow: isActive ? `0 0 20px ${APP_ACCENT_GLOW}` : 'none',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: APP_ACCENT_SURFACE,
                    borderColor: 'transparent'
                  }
                }}
              >
                <ListItemIcon sx={{ 
                  minWidth: 40,
                  color: isActive ? APP_PRIMARY_BLUE_DARK : APP_PRIMARY_BLUE
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    sx: {
                      color: APP_TEXT_PRIMARY,
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.95rem'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}

        {/* Admin Section - Only visible to Admin users */}
        {isAdmin && (
          <>
            <Divider sx={{ my: 2, borderColor: APP_BORDER_BLUE_SOFT }} />
            <Typography 
              variant="caption" 
              sx={{ 
                color: APP_TEXT_SECONDARY,
                px: 2, 
                mb: 1, 
                display: 'block',
                fontWeight: 600,
                letterSpacing: '0.5px'
              }}
            >
              ניהול מערכת
            </Typography>
            {adminMenuItems.map((item) => {
              const isActive = location.pathname === item.path;
              
              return (
                <ListItem key={item.path} disablePadding sx={{ mb: 0 }}>
                  <ListItemButton
                    component={Link}
                    to={item.path}
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      px: 2,
                      backgroundColor: isActive ? APP_ACCENT_LIGHT : 'transparent',
                      border: isActive ? `1px solid ${APP_ACCENT_GLOW}` : '1px solid transparent',
                      boxShadow: isActive ? `0 0 20px ${APP_ACCENT_GLOW}` : 'none',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: APP_ACCENT_SURFACE,
                        borderColor: 'transparent'
                      }
                    }}
                  >
                    <ListItemIcon sx={{ 
                      minWidth: 40,
                      color: isActive ? APP_PRIMARY_BLUE_DARK : APP_PRIMARY_BLUE
                    }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.text}
                      primaryTypographyProps={{
                        sx: {
                          color: APP_TEXT_PRIMARY,
                          fontWeight: isActive ? 700 : 500,
                          fontSize: '0.95rem'
                        }
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </>
        )}
      </List>

      {/* פוטר */}
      <Box sx={{ 
        p: 2, 
        borderTop: `1px solid ${APP_BORDER_BLUE_SOFT}`,
        textAlign: 'center'
      }}>
        <Typography variant="caption" sx={{ 
          color: APP_TEXT_SECONDARY,
          fontSize: '0.75rem',
          fontWeight: 500
        }}>
          חטיבת הסייבר והתשתיות
        </Typography>
      </Box>
    </Box>
  );
};

export default Sidebar; 