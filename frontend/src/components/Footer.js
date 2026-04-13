import React from 'react';
import { Box, Typography, Container } from '@mui/material';
import { APP_BACKGROUND_DEFAULT, APP_BORDER_BLUE_SOFT, APP_TEXT_SECONDARY } from '../themeTokens';

function Footer() {
  return (
    <Box 
      component="footer"
      sx={{
        background: APP_BACKGROUND_DEFAULT,
        borderTop: `1px solid ${APP_BORDER_BLUE_SOFT}`,
        py: 2,
        flexShrink: 0,
      }}
    >
      <Container maxWidth="xl">
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <Typography 
            variant="body1" 
            sx={{ 
              color: APP_TEXT_SECONDARY,
              fontWeight: 500,
              fontSize: '0.95rem',
              letterSpacing: '0.5px'
            }}
          >
         חטיבת הסייבר ותשתיות טכנולוגיות
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default Footer; 