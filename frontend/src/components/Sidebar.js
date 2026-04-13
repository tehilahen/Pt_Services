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
        backgroundColor: '#063970', // Dark blue from memory
        borderRight: '2px solid rgba(52, 152, 219, 0.4)', // Blue transparent
        
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* כותרת */}
      <Box sx={{ 
        p: 3, 
        borderBottom: '1px solid rgba(52, 152, 219, 0.3)', // Blue transparent
        textAlign: 'center'
      }}>
        <Typography variant="h6" sx={{ 
          color: '#ECF0F1', // White
          fontWeight: 700,
          mb: 1
        }}>
          PT Service
        </Typography>
        <Typography variant="caption" sx={{ 
          color: '#BDC3C7' // Light gray
        }}>
          מערכת לביצוע מבדקי חדירות
        </Typography>
      </Box>

      {/* תפריט */}
      <List sx={{ flex: 1, p: 2 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0, '&:not(:last-child)': { borderBottom: '1px solid rgba(52, 152, 219, 0.1)' } }}>
              <ListItemButton
                component={Link}
                to={item.path}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  px: 2,
                  backgroundColor: isActive ? 'rgba(52, 152, 219, 0.2)' : 'transparent', // Blue transparent
                  border: '1px solid transparent',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(52, 152, 219, 0.3)', // Darker blue transparent
                    borderColor: 'transparent'
                  }
                }}
              >
                <ListItemIcon sx={{ 
                  minWidth: 40,
                  color: '#3498DB' // Bright blue
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    sx: {
                      color: '#ECF0F1', // White
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
            <Divider sx={{ my: 2, borderColor: 'rgba(52, 152, 219, 0.3)' }} />
            <Typography 
              variant="caption" 
              sx={{ 
                color: '#BDC3C7', 
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
                      backgroundColor: isActive ? 'rgba(52, 152, 219, 0.2)' : 'transparent',
                      border: '1px solid transparent',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: 'rgba(52, 152, 219, 0.3)',
                        borderColor: 'transparent'
                      }
                    }}
                  >
                    <ListItemIcon sx={{ 
                      minWidth: 40,
                      color: '#3498DB'
                    }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.text}
                      primaryTypographyProps={{
                        sx: {
                          color: '#ECF0F1',
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
        borderTop: '1px solid rgba(52, 152, 219, 0.3)', // Blue transparent
        textAlign: 'center'
      }}>
        <Typography variant="caption" sx={{ 
          color: '#BDC3C7', // Light gray
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