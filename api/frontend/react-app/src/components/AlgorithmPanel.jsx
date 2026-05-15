import React from 'react';
import {
  Box, Paper, Stack, Typography, Button, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Tooltip,
  useMediaQuery, useTheme,
} from '@mui/material';
import { PlayArrow as RunIcon } from '@mui/icons-material';
import JobStatus from './JobStatus';
import { ALGORITHM_REGISTRY } from '../config/algorithmConfig';

const ALGORITHM_OPTIONS = Object.entries(ALGORITHM_REGISTRY).map(([key, cfg]) => ({ key, ...cfg }));

export default function AlgorithmPanel({
  selectedAlgorithmKey,
  onAlgorithmChange,
  algorithm,
  job,
  runDisabled,
  totalPixelCount,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} flexWrap="wrap">
          <Typography variant="subtitle2" fontWeight={600}>
            Run Algorithm
          </Typography>

          <FormControl size="small" sx={{ minWidth: 160, width: { xs: '100%', sm: 'auto' } }}>
            <InputLabel sx={{ fontSize: 13 }}>Algorithm</InputLabel>
            <Select
              value={selectedAlgorithmKey}
              label="Algorithm"
              onChange={e => onAlgorithmChange(e.target.value)}
              sx={{ fontSize: 13 }}
            >
              {ALGORITHM_OPTIONS.map(({ key, label, description }) => (
                <MenuItem key={key} value={key}>
                  <Tooltip title={description} placement="right">
                    <span>{label}</span>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            size="small"
            color="error"
            startIcon={job.isPolling ? <CircularProgress size={14} color="inherit" /> : <RunIcon />}
            onClick={() => {
              if (!window.confirm(`Run ${algorithm.label} on the selected pixels?`)) return;
              job.handleRun();
            }}
            disabled={runDisabled || job.isPolling}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            {isMobile
              ? `Run ${algorithm.label}`
              : `Run ${algorithm.label}${totalPixelCount ? ` (${totalPixelCount.toLocaleString()} px)` : ''}`}
          </Button>

          {algorithm.description && (
            <Typography variant="caption" color="text.secondary">
              {algorithm.description}
            </Typography>
          )}
        </Stack>
      </Paper>

      <JobStatus
        parentJobId={job.activeJobId}
        algorithm={algorithm}
        isPolling={job.isPolling}
        onStopPolling={() => job.setIsPolling(false)}
        onStartPolling={() => job.setIsPolling(true)}
        onClose={() => { job.setIsPolling(false); job.setActiveJobId(null); }}
      />
    </Box>
  );
}
