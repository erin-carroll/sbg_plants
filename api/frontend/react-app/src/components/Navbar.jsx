import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography,
  IconButton, Box, Button, Tooltip, Tabs, Tab,
} from '@mui/material';
import { Logout as LogoutIcon } from '@mui/icons-material';
import { redirectToLogout } from '../utils/auth';
import { useIsAdmin } from '../hooks/useIsAdmin';

function Navbar({ showControls = true }) {
  const { isAdmin, isSuperAdmin } = useIsAdmin();
  const navigate  = useNavigate();
  const location  = useLocation();

  // Map pathname to tab value — unknown paths fall back to false (no tab highlighted)
  const TAB_PATHS = ['/', '/data-products', '/ingest', '/admin'];
  const currentTab = TAB_PATHS.includes(location.pathname) ? location.pathname : false;

  return (
    <>
      <AppBar position="fixed" elevation={2}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', minHeight: 56 }}>

          {/* Left — title */}
          <Typography variant="h6" sx={{
            fontWeight: 700, mr: 3, whiteSpace: 'nowrap', fontSize: '1.5rem',
            background: 'linear-gradient(90deg, #37598C, #0091DB, #3E8450, #E8CC56, #DB9D3A, #C16B49)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            VSWIR Plants
          </Typography>

          {/* Centre — persistent nav tabs */}
          <Tabs
            value={currentTab}
            onChange={(_, val) => navigate(val)}
            textColor="inherit"
            TabIndicatorProps={{ style: { backgroundColor: '#0091DB', height: 3 } }}
            sx={{ flex: 1 }}
          >
            <Tab
              label="Query"
              value="/"
              sx={{ textTransform: 'none', fontWeight: 500, color: 'rgba(255,255,255,0.8)',
                    '&.Mui-selected': { color: '#0091DB' },
                    '&:hover': { color: '#0091DB' } }}
            />
            {isSuperAdmin && (
              <Tab
                label="Data Products"
                value="/data-products"
                sx={{ textTransform: 'none', fontWeight: 500, color: 'rgba(255,255,255,0.8)',
                      '&.Mui-selected': { color: '#0091DB' },
                      '&:hover': { color: '#0091DB' } }}
              />
            )}
            {isAdmin && (
              <Tab
                label="Ingest"
                value="/ingest"
                sx={{ textTransform: 'none', fontWeight: 500, color: 'rgba(255,255,255,0.8)',
                      '&.Mui-selected': { color: '#0091DB' },
                      '&:hover': { color: '#0091DB' } }}
              />
            )}
            {isAdmin && (
              <Tab
                label="Admin"
                value="/admin"
                sx={{ textTransform: 'none', fontWeight: 500, color: 'rgba(255,255,255,0.8)',
                      '&.Mui-selected': { color: '#0091DB' },
                      '&:hover': { color: '#0091DB' } }}
              />
            )}
          </Tabs>

          {/* Right — logout */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

            <Button
              color="inherit"
              onClick={redirectToLogout}
              startIcon={<LogoutIcon />}
              sx={{ textTransform: 'none', fontWeight: 500, '&:hover': { color: '#0091DB' } }}
            >
              Logout
            </Button>
          </Box>

        </Toolbar>
      </AppBar>
      <Toolbar />
    </>
  );
}

export default Navbar;
