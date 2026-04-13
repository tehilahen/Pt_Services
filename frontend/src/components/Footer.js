import React from 'react';
import { Box, Typography, Container } from '@mui/material';

function Footer() {
  return (
    <Box 
      component="footer"
      sx={{
        background: 'linear-gradient(135deg, #0e2747 0%, #091a33 100%)',
        borderTop: '1px solid rgba(58, 129, 177, 0.2)',
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
              color: 'rgba(189, 195, 199, 0.9)',
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