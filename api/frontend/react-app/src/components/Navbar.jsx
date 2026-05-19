import React, { useState } from 'react';
import aiLogo from '../../public/ai_logo_terracotta_plane.png';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography,
  IconButton, Box, Button, Tooltip, Tabs, Tab,
  Drawer, List, ListItem, ListItemButton, ListItemText, Divider,
  useMediaQuery, useTheme,
} from '@mui/material';
import { Logout as LogoutIcon, Menu as MenuIcon } from '@mui/icons-material';
import { redirectToLogout } from '../utils/auth';
import { useIsAdmin } from '../hooks/useIsAdmin';

function Navbar({ showControls = true }) {
  const { isAdmin, isSuperAdmin } = useIsAdmin();
  const navigate  = useNavigate();
  const location  = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const TAB_PATHS = ['/', '/data-products', '/ingest', '/admin'];
  const currentTab = TAB_PATHS.includes(location.pathname) ? location.pathname : false;

  const navItems = [
    { label: 'Query', value: '/', show: true },
    { label: 'Data Products', value: '/data-products', show: isSuperAdmin },
    { label: 'Ingest', value: '/ingest', show: isAdmin },
    { label: 'Admin', value: '/admin', show: isAdmin },
  ].filter(i => i.show);

  const titleTypography = (
    <Typography variant="h6" sx={{
      fontWeight: 700, whiteSpace: 'nowrap', fontSize: '1.5rem',
      background: 'linear-gradient(90deg, #37598C, #0091DB, #3E8450, #E8CC56, #DB9D3A, #C16B49)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    }}>
      VSWIR Plants
    </Typography>
  );

  return (
    <>
      <AppBar position="fixed" elevation={2}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', minHeight: 56 }}>

          {/* Left — title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isMobile && (
              <IconButton
                edge="start"
                onClick={() => setDrawerOpen(true)}
                sx={{ color: 'rgba(255,255,255,0.8)', mr: 0.5 }}
                size="small"
              >
                <MenuIcon />
              </IconButton>
            )}
            <Box component="img" src={aiLogo} alt="AI Logo" sx={{ height: 52, width: 'auto' }} />
            {titleTypography}
          </Box>

          {/* Centre — tabs (desktop only) */}
          {!isMobile && (
            <Tabs
              value={currentTab}
              onChange={(_, val) => navigate(val)}
              textColor="inherit"
              TabIndicatorProps={{ style: { backgroundColor: '#0091DB', height: 3 } }}
              sx={{ flex: 1, ml: 2 }}
            >
              {navItems.map(item => (
                <Tab
                  key={item.value}
                  label={item.label}
                  value={item.value}
                  sx={{ textTransform: 'none', fontWeight: 600, color: 'rgba(255,255,255,0.8)',
                        '&.Mui-selected': { color: '#0091DB' },
                        '&:hover': { color: '#0091DB' } }}
                />
              ))}
            </Tabs>
          )}

          {/* Right — logout (desktop) / spacer (mobile) */}
          {!isMobile && (
            <Button
              onClick={redirectToLogout}
              startIcon={<LogoutIcon />}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', letterSpacing: 0, color: 'rgba(255,255,255,0.7)', bgcolor: 'transparent', boxShadow: 'none', '&:hover': { color: '#0091DB', bgcolor: 'transparent', boxShadow: 'none' } }}
            >
              Logout
            </Button>
          )}

        </Toolbar>
      </AppBar>

      {/* Mobile nav drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 240, mt: '56px', height: 'calc(100% - 56px)', bgcolor: 'primary.main' } }}
      >
        <List sx={{ pt: 1 }}>
          {navItems.map(item => (
            <ListItem key={item.value} disablePadding>
              <ListItemButton
                selected={currentTab === item.value}
                onClick={() => { navigate(item.value); setDrawerOpen(false); }}
                sx={{
                  color: 'rgba(255,255,255,0.85)',
                  fontWeight: 600,
                  '&.Mui-selected': { bgcolor: 'rgba(0,145,219,0.25)', color: '#0091DB' },
                  '&:hover': { bgcolor: 'rgba(0,145,219,0.15)', color: '#0091DB' },
                }}
              >
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <List>
          <ListItem disablePadding>
            <ListItemButton
              onClick={redirectToLogout}
              sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#0091DB', bgcolor: 'rgba(0,145,219,0.15)' } }}
            >
              <LogoutIcon sx={{ mr: 1.5, fontSize: 18 }} />
              <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      <Toolbar />
    </>
  );
}

export default Navbar;
