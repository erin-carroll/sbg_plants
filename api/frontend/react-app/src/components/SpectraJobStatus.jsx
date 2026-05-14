import React from 'react';
import { Paper, Typography, Button, Box, Chip, useTheme } from '@mui/material';
import { Download as DownloadIcon, HourglassEmpty, CheckCircle, PlayArrow, Error as ErrorIcon } from '@mui/icons-material';

const getStatusConfig = (status, theme) => {
  switch (status) {
    case 'complete':
      return { bgcolor: theme.palette.success.light, borderColor: theme.palette.success.main, icon: <CheckCircle sx={{ color: 'success.main', mr: 1 }} />, label: 'Complete', chipColor: 'success' };
    case 'running':
      return { bgcolor: theme.palette.warning.light, borderColor: theme.palette.warning.main, icon: <PlayArrow sx={{ color: 'warning.main', mr: 1 }} />, label: 'Running', chipColor: 'warning' };
    case 'failed':
      return { bgcolor: theme.palette.error.light, borderColor: theme.palette.error.main, icon: <ErrorIcon sx={{ color: 'error.main', mr: 1 }} />, label: 'Failed', chipColor: 'error' };
    case 'queued':
    default:
      return { bgcolor: theme.palette.info.light, borderColor: theme.palette.info.main, icon: <HourglassEmpty sx={{ color: 'info.main', mr: 1 }} />, label: 'Queued', chipColor: 'info' };
  }
};

function SpectraJobStatus({ jobsBySensor, sensorStatuses }) {
  const theme = useTheme();
  if (!jobsBySensor || Object.keys(jobsBySensor).length === 0) return null;

  return (
    <Box>
      {Object.entries(jobsBySensor).map(([sensorKey, jobId]) => {
        const state = sensorStatuses[sensorKey] ?? { status: 'queued', rowsProcessed: 0 };
        const statusConfig = getStatusConfig(state.status, theme);

        return (
          <Paper
            key={sensorKey}
            elevation={1}
            sx={{ p: 2, mb: 2, bgcolor: 'background.paper', borderLeft: `4px solid ${statusConfig.borderColor}` }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              {statusConfig.icon}
              <Typography variant="h6" sx={{ mr: 2 }}>{sensorKey}</Typography>
              <Chip label={statusConfig.label} color={statusConfig.chipColor} size="small" />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              <strong>Job ID:</strong> {jobId}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>Rows processed:</strong> {state.rowsProcessed.toLocaleString()}
            </Typography>

            {state.error && (
              <Typography variant="body2" color="error">{state.error}</Typography>
            )}

            {state.downloadUrl && state.status === 'complete' && (
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<DownloadIcon />}
                sx={{ mt: 1 }}
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = state.downloadUrl;
                  a.download = `${sensorKey}_spectra.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                Download Spectra Data
              </Button>
            )}
          </Paper>
        );
      })}
    </Box>
  );
}

export default SpectraJobStatus;
