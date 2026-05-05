import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, LinearProgress,
  Alert, CircularProgress, Button, IconButton, Slider, Divider,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Warning as WarningIcon,
  ContentCopy as CopyIcon,
  PlayArrow as MonitorIcon,
  Close as CloseIcon,
  Publish as PromoteIcon,
  DeleteForever as DeleteIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useIsoFitPolling } from '../hooks/useIsoFitPolling';
import { promoteProductJob, deleteAlgorithmJob, downloadAlgorithmJobData, pollJobStatus } from '../utils/api';
import { useSchema } from '../context/SchemaContext';

const STATUS_CONFIG = {
  complete:    { color: 'success', label: 'Complete',     icon: <SuccessIcon fontSize="small" /> },
  promoted:    { color: 'success', label: 'Promoted',     icon: <SuccessIcon fontSize="small" /> },
  deleted:     { color: 'error',   label: 'Deleted',      icon: <ErrorIcon fontSize="small" /> },
  failed:      { color: 'error',   label: 'Failed',       icon: <ErrorIcon fontSize="small" /> },
  partial:     { color: 'warning', label: 'Partial Fail', icon: <WarningIcon fontSize="small" /> },
  in_progress: { color: 'primary', label: 'In Progress',  icon: <CircularProgress size={12} color="inherit" /> },
  submitted:   { color: 'info',    label: 'Submitted',    icon: <PendingIcon fontSize="small" /> },
  unknown:     { color: 'default', label: 'Unknown',      icon: <PendingIcon fontSize="small" /> },
  loading:     { color: 'default', label: 'Loading',      icon: <CircularProgress size={12} color="inherit" /> },
};

const POLL_MIN     = 30;
const POLL_MAX     = 600;
const POLL_DEFAULT = 60;

function StatusChip({ status }) {
  const { color, label, icon } = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return <Chip label={label} color={color} size="small" icon={icon} />;
}

function MetricCard({ label, value, color }) {
  return (
    <Paper elevation={1} sx={{ p: 2, textAlign: 'center', borderTop: 3, borderColor: color || 'primary.main' }}>
      <Typography variant="h4" fontWeight={700} color={color || 'primary.main'}>
        {value ?? '—'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {label}
      </Typography>
    </Paper>
  );
}

/**
 * Job status panel for any algorithm job.
 *
 * @param {string}   parentJobId    - Active parent job ID to monitor
 * @param {object}   algorithm      - Entry from ALGORITHM_REGISTRY (for display label)
 * @param {boolean}  isPolling      - Whether interval polling is active
 * @param {function} onStopPolling
 * @param {function} onStartPolling
 * @param {function} onClose
 */
export default function JobStatus({
  parentJobId,
  algorithm,
  isPolling,
  onStopPolling,
  onStartPolling,
  onClose,
}) {
  const { schema } = useSchema();
  const [pollIntervalSecs, setPollIntervalSecs] = useState(POLL_DEFAULT);
  const [promoting, setPromoting]               = useState(false);
  const [promoteError, setPromoteError]         = useState('');
  const [promoted, setPromoted]                 = useState(false);
  const [deleting, setDeleting]                 = useState(false);
  const [deleteError, setDeleteError]           = useState('');
  const [deleted, setDeleted]                   = useState(false);

  // Download state
  const [downloadLoading,  setDownloadLoading]  = useState(false);
  const [downloadError,    setDownloadError]    = useState('');
  const [downloadStatuses, setDownloadStatuses] = useState({}); // { "campaign|sensor": { status, downloadUrl } }
  const downloadIntervalsRef = useRef({});

  const { jobData, pollingError, lastUpdated, isComplete, canPoll, derivedStatus } =
    useIsoFitPolling(parentJobId, isPolling, pollIntervalSecs * 1000, onStopPolling);

  const handlePromote = async () => {
    if (!window.confirm(
      `Promote ${algorithm?.label ?? 'job'} results for job ${parentJobId?.slice(0, 8)}… to production?\n\n` +
      `This will move all staging rows for this job's pixels into the production table.`
    )) return;
    setPromoting(true);
    setPromoteError('');
    try {
      await promoteProductJob(algorithm.productKey, parentJobId);
      setPromoted(true);
    } catch (err) {
      setPromoteError(err.message || 'Promotion failed');
    } finally {
      setPromoting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(
      `Delete staging rows for job ${parentJobId?.slice(0, 8)}…?\n\n` +
      `This will permanently remove the staging output for this job. This cannot be undone.`
    )) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAlgorithmJob(algorithm.productKey, parentJobId);
      setDeleted(true);
    } catch (err) {
      setDeleteError(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {    // If promoted, always download from production regardless of schema toggle.
    // If not promoted, download from staging.
    const downloadSchema = derivedStatus === 'promoted' ? 'production' : 'staging';
    setDownloadLoading(true);
    setDownloadError('');
    setDownloadStatuses({});
    // Clear any existing intervals
    Object.values(downloadIntervalsRef.current).forEach(clearInterval);
    downloadIntervalsRef.current = {};

    try {
      const jobsBySensor = await downloadAlgorithmJobData(parentJobId, algorithm, downloadSchema);

      // Initialise statuses
      const initial = Object.fromEntries(
        Object.keys(jobsBySensor).map(k => [k, { status: 'queued', downloadUrl: null }])
      );
      setDownloadStatuses(initial);

      // Poll each sensor job
      Object.entries(jobsBySensor).forEach(([sensorKey, jobId]) => {
        const poll = async () => {
          try {
            const result = await pollJobStatus(jobId);
            const status = result.presigned_url ? 'complete' : (result.status === 'failed' ? 'failed' : 'running');
            setDownloadStatuses(prev => ({
              ...prev,
              [sensorKey]: { status, downloadUrl: result.presigned_url || null },
            }));
            if (result.presigned_url || result.status === 'failed') {
              clearInterval(downloadIntervalsRef.current[sensorKey]);
              delete downloadIntervalsRef.current[sensorKey];
            }
          } catch (err) {
            setDownloadStatuses(prev => ({
              ...prev,
              [sensorKey]: { status: 'failed', downloadUrl: null },
            }));
            clearInterval(downloadIntervalsRef.current[sensorKey]);
            delete downloadIntervalsRef.current[sensorKey];
          }
        };
        poll();
        downloadIntervalsRef.current[sensorKey] = setInterval(poll, 2000);
      });
    } catch (err) {
      setDownloadError(err.message || 'Failed to start download');
    } finally {
      setDownloadLoading(false);
    }
  };

  // Clean up download intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(downloadIntervalsRef.current).forEach(clearInterval);
    };
  }, []);

  // Reset all job-specific state when the viewed job or algorithm changes
  useEffect(() => {
    Object.values(downloadIntervalsRef.current).forEach(clearInterval);
    downloadIntervalsRef.current = {};
    setDownloadLoading(false);
    setDownloadError('');
    setDownloadStatuses({});
    setPromoted(false);
    setPromoteError('');
    setDeleted(false);
    setDeleteError('');
    setPromoting(false);
    setDeleting(false);
  }, [parentJobId, algorithm]);

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

  const totalPixels = jobData
    ? (jobData.total_pixels_processed || 0) + (jobData.total_pixels_remaining || 0)
    : 0;
  const pixelProgress = totalPixels > 0
    ? Math.round(((jobData?.total_pixels_processed || 0) / totalPixels) * 100)
    : 0;

  const batchCounts = jobData?.statuses
    ? Object.entries(jobData.statuses).reduce((acc, [s, count]) => {
        acc[s] = (acc[s] || 0) + count;
        return acc;
      }, {})
    : {};

  if (!parentJobId) return null;

  const algorithmLabel = algorithm?.label ?? 'Job';

  return (
    <Paper sx={{ p: 2.5, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>{algorithmLabel} Job:</Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{parentJobId}</Typography>
          <Button size="small" onClick={() => copyToClipboard(parentJobId)} sx={{ minWidth: 0, p: 0.5 }}>
            <CopyIcon fontSize="small" />
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <StatusChip status={derivedStatus} />
          {isPolling && (
            <Button size="small" variant="outlined" color="error" onClick={onStopPolling}>
              Stop
            </Button>
          )}
          {!isPolling && canPoll && derivedStatus !== 'failed' && derivedStatus !== 'complete' && (
            <Button size="small" variant="outlined" color="primary" startIcon={<MonitorIcon />} onClick={onStartPolling}>
              Monitor
            </Button>
          )}
          {(isComplete || derivedStatus === 'partial') && derivedStatus !== 'deleted' && !promoted && !deleted && derivedStatus !== 'promoted' && algorithm?.productKey && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={promoting ? <CircularProgress size={12} color="inherit" /> : <PromoteIcon fontSize="small" />}
              onClick={handlePromote}
              disabled={promoting}
              sx={{ textTransform: 'none' }}
            >
              Promote
            </Button>
          )}
          {(isComplete || derivedStatus === 'partial') && derivedStatus !== 'deleted' && !deleted && algorithm?.downloadView && (
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={downloadLoading ? <CircularProgress size={12} color="inherit" /> : <DownloadIcon fontSize="small" />}
              onClick={handleDownload}
              disabled={downloadLoading}
              sx={{ textTransform: 'none' }}
            >
              Download Data
            </Button>
          )}
          {promoted && <Chip label="Promoted" color="success" size="small" />}
          {(isComplete || derivedStatus === 'partial') && derivedStatus !== 'deleted' && !promoted && !deleted && derivedStatus !== 'promoted' && algorithm?.productKey && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={deleting ? <CircularProgress size={12} color="inherit" /> : <DeleteIcon fontSize="small" />}
              onClick={handleDelete}
              disabled={deleting}
              sx={{ textTransform: 'none' }}
            >
              Delete
            </Button>
          )}
          {deleted && <Chip label="Deleted" color="error" size="small" />}
          <IconButton size="small" onClick={() => { onStopPolling?.(); onClose?.(); }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Poll interval control */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, maxWidth: 360 }}>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          Poll every {pollIntervalSecs}s
        </Typography>
        <Slider
          value={pollIntervalSecs}
          min={POLL_MIN}
          max={POLL_MAX}
          step={30}
          onChange={(_, val) => setPollIntervalSecs(val)}
          disabled={isPolling}
          size="small"
        />
      </Box>

      {pollingError && <Alert severity="error" sx={{ mb: 2 }}>{pollingError}</Alert>}
      {promoteError && <Alert severity="error" sx={{ mb: 2 }}>{promoteError}</Alert>}
      {deleteError  && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}

      {!jobData && !pollingError && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {jobData && (
        <>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">Pixel Progress</Typography>
              <Typography variant="body2" fontWeight={600}>{pixelProgress}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={pixelProgress}
              sx={{ height: 8, borderRadius: 4 }}
              color={isComplete ? 'success' : 'primary'}
            />
            {lastUpdated && (
              <Typography variant="caption" color="text.secondary">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </Typography>
            )}
          </Box>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} sm={3}>
              <MetricCard label="Total Batches"     value={jobData.total_batches} color="primary.main" />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricCard label="Pixels Processed"  value={jobData.total_pixels_processed?.toLocaleString()} color="success.main" />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricCard
                label="Pixels Remaining"
                value={jobData.total_pixels_remaining?.toLocaleString()}
                color={jobData.total_pixels_remaining > 0 ? 'warning.main' : 'success.main'}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricCard
                label="Restarted Jobs"
                value={jobData.restarted_jobs?.length ?? 0}
                color={jobData.restarted_jobs?.length > 0 ? 'error.main' : 'text.secondary'}
              />
            </Grid>
          </Grid>

          {Object.keys(batchCounts).length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>Batch Status Breakdown</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Object.entries(batchCounts).map(([status, count]) => (
                  <Chip
                    key={status}
                    label={`${status}: ${count}`}
                    size="small"
                    color={status === 'complete' ? 'success' : status === 'failed' ? 'error' : 'default'}
                  />
                ))}
              </Box>
            </Box>
          )}

          {jobData.restart_required && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Restart required. Some batches need to be re-queued.
            </Alert>
          )}

          {jobData.failed_jobs_pixel_ids?.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom color="error">
                Failed Pixel IDs ({jobData.failed_jobs_pixel_ids.length})
              </Typography>
              <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 120, overflow: 'auto', bgcolor: 'grey.50' }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {jobData.failed_jobs_pixel_ids.join(', ')}
                </Typography>
              </Paper>
              <Button
                size="small"
                sx={{ mt: 0.5 }}
                startIcon={<CopyIcon fontSize="small" />}
                onClick={() => copyToClipboard(jobData.failed_jobs_pixel_ids.join(', '))}
              >
                Copy IDs
              </Button>
            </Box>
          )}
        </>
      )}

      {/* Download job statuses */}
      {(downloadError || Object.keys(downloadStatuses).length > 0) && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>Data Download</Typography>
          {downloadError && <Alert severity="error" sx={{ mb: 1 }}>{downloadError}</Alert>}
          {Object.entries(downloadStatuses).map(([sensorKey, state]) => (
            <Box key={sensorKey} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>{sensorKey}</Typography>
              {state.status === 'queued'   && <Chip label="Queued"   color="info"    size="small" />}
              {state.status === 'running'  && <Chip label="Running"  color="warning" size="small" icon={<CircularProgress size={10} color="inherit" />} />}
              {state.status === 'failed'   && <Chip label="Failed"   color="error"   size="small" />}
              {state.status === 'complete' && state.downloadUrl && (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<DownloadIcon fontSize="small" />}
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = state.downloadUrl;
                    a.download = `${sensorKey}_${algorithm?.label ?? 'data'}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  Download
                </Button>
              )}
            </Box>
          ))}
        </>
      )}
    </Paper>
  );
}
