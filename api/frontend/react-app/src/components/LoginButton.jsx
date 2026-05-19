import React from "react";
import { Box, Typography, Button, AppBar, Toolbar } from "@mui/material";
import { Login as LoginIcon } from "@mui/icons-material";
import { redirectToLogin } from "../utils/auth";
import aiLogo from '../../public/ai_logo_terracotta_plane.png';

export default function LoginButton() {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'grey.100' }}>
      {/* Same navbar as the app, but no controls */}
      <AppBar position="fixed" elevation={2}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', minHeight: 56 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="img" src={aiLogo} alt="AI Logo" sx={{ height: 52, width: 'auto' }} />
            <Typography variant="h6" sx={{
            fontWeight: 700, whiteSpace: 'nowrap', fontSize: '1.5rem',
            background: 'linear-gradient(90deg, #37598C, #0091DB, #3E8450, #E8CC56, #DB9D3A, #C16B49)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            VSWIR Plants
          </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Toolbar />

      {/* Centered login card */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 64px)',
          px: 2,
        }}
      >
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 3,
            borderLeft: '4px solid',
            borderColor: 'primary.main',
            p: 5,
            maxWidth: 400,
            width: '100%',
            textAlign: 'center',
          }}
        >
          {/* Icon */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box component="img" src={aiLogo} alt="AI Logo" sx={{ height: 80, width: 'auto' }} />
          </Box>

          <Typography variant="h5" sx={{
            fontWeight: 700, mb: 1,
            background: 'linear-gradient(90deg, #37598C, #0091DB, #3E8450, #E8CC56, #DB9D3A, #C16B49)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            VSWIR Plants
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Sign in to access plant spectral data and analysis tools.
          </Typography>

          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={redirectToLogin}
            startIcon={<LoginIcon />}
            fullWidth
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              py: 1.5,
              fontSize: '1rem',
            }}
          >
            Sign in with VSWIR Plants SSO
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
