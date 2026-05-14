import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Paper, Button, Stack, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Divider, Tooltip, LinearProgress,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import Navbar from '../components/Navbar';
import { BatchRow } from '../components';
import { ingestApi } from '../utils/api';
import { useIngestionPolling } from '../hooks/useIngestionPolling';

// ── File slot definitions ─────────────────────────────────────────────────────

const DEFAULT_FILE_SLOTS = [
  { key: 'campaign_metadata', label: 'Campaign Metadata',  accept: '.csv',           hint: 'campaign_metadata.csv — one row per campaign + sensor combination' },
  { key: 'wavelengths',       label: 'Wavelengths',         accept: '.csv',           hint: 'wavelengths.csv — one row per band, ordered by band index' },
  { key: 'granule_metadata',  label: 'Granule Metadata',   accept: '.csv',           hint: 'granule_metadata.csv — one row per granule' },
  { key: 'plots',             label: 'Plots',               accept: '.geojson,.json', hint: 'plots.geojson — FeatureCollection of plot-granule intersection polygons (EPSG:4326)' },
  { key: 'traits',            label: 'Traits',              accept: '.csv',           hint: 'traits.csv — one row per trait measurement' },
  { key: 'spectra',           label: 'Spectra',             accept: '.csv',           hint: 'spectra.csv — one row per pixel with positional band columns (0, 1, 2 …)' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IngestPage() {
  const [fileSlots, setFileSlots]         = useState(DEFAULT_FILE_SLOTS);
  const [files, setFiles]                 = useState({});
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const [batches, setBatches]               = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchError, setBatchError]         = useState('');
  const [actionError, setActionError]       = useState('');

  // Load file slot config from backend on mount
  useEffect(() => {
    ingestApi.getConfig()
      .then(config => {
        if (config?.file_slots) {
          setFileSlots(Object.entries(config.file_slots).map(([key, ext]) => ({
            key,
            label:  key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            accept: ext === '.geojson' ? '.geojson,.json' : ext,
            hint:   `${key}${ext}`,
          })));
        }
      })
      .catch(() => {}); // fall back to DEFAULT_FILE_SLOTS
  }, []);

  const handleBatchUpdate = useCallback((updated) => {
    setBatches(prev => prev.map(b => b.batch_id === updated.batch_id ? updated : b));
  }, []);

  useIngestionPolling(batches, handleBatchUpdate);
  useEffect(() => { loadBatches(); }, []);

  async function loadBatches() {
    setLoadingBatches(true);
    setBatchError('');
    try {
      setBatches(await ingestApi.listBatches());
    } catch (err) {
      setBatchError(err.message);
    } finally {
      setLoadingBatches(false);
    }
  }

  const fileInputRefs = useRef({});

  function handleFileChange(key, e) {
    const file = e.target.files[0];
    if (file) setFiles(prev => ({ ...prev, [key]: file }));
  }

  function handleFileClear(key) {
    setFiles(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (fileInputRefs.current[key]) fileInputRefs.current[key].value = '';
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');
    try {
      const result = await ingestApi.submitBatch(files);
      setSubmitSuccess(`Batch submitted — ID: ${result.batch_id}`);
      setFiles({});
      fileSlots.forEach(s => {
        if (fileInputRefs.current[s.key]) fileInputRefs.current[s.key].value = '';
      });
      setBatches(prev => [{
        batch_id:    result.batch_id,
        status:      'PENDING',
        uploaded_by: result.uploaded_by ?? '—',
        uploaded_at: result.uploaded_at ?? new Date().toISOString(),
        files:       fileSlots.map(s => s.key),
        qaqc_report: null,
      }, ...prev]);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(batchId) {
    if (!window.confirm('Approve this batch and promote to production?')) return;
    setActionError('');
    try {
      const updated = await ingestApi.approveBatch(batchId);
      setBatches(prev => prev.map(b => b.batch_id === batchId ? { ...b, ...updated } : b));
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleReject(batchId) {
    if (!window.confirm('Reject this batch? Staging data will be discarded.')) return;
    setActionError('');
    try {
      const updated = await ingestApi.rejectBatch(batchId);
      setBatches(prev => prev.map(b => b.batch_id === batchId ? { ...b, ...updated } : b));
    } catch (err) {
      setActionError(err.message);
    }
  }

  const allFilesSelected = fileSlots.every(s => files[s.key]);
  const fileSlotKeys     = fileSlots.map(s => s.key);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Navbar />
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={4} alignItems="flex-start">

          {/* Upload panel */}
          <Box component={Paper} variant="outlined" sx={{ p: 3, width: { xs: '100%', lg: 380 }, flexShrink: 0 }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>Submit Ingestion Bundle</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              All 6 files are required. Files are validated asynchronously — you can track progress in the batch list.
            </Typography>

            {submitError   && <Alert severity="error"   sx={{ mb: 2 }}>{submitError}</Alert>}
            {submitSuccess && <Alert severity="success" sx={{ mb: 2 }}>{submitSuccess}</Alert>}

            <Stack spacing={2}>
              {fileSlots.map(slot => (
                <Box key={slot.key}>
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                    {slot.label} <Typography component="span" color="error">*</Typography>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    {slot.hint}
                  </Typography>
                  <input
                    ref={el => { fileInputRefs.current[slot.key] = el; }}
                    type="file"
                    accept={slot.accept}
                    onChange={e => handleFileChange(slot.key, e)}
                    style={{ display: 'block', width: '100%' }}
                  />
                  {files[slot.key] && (
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                      <Chip
                        label={files[slot.key].name}
                        size="small"
                        color="primary"
                        variant="outlined"
                        onDelete={() => handleFileClear(slot.key)}
                      />
                    </Stack>
                  )}
                </Box>
              ))}

              <Divider />

              <Button
                variant="contained"
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
                onClick={handleSubmit}
                disabled={!allFilesSelected || submitting}
                fullWidth
              >
                {submitting ? 'Uploading…' : 'Submit Bundle'}
              </Button>
            </Stack>
          </Box>

          {/* Batch list */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Ingestion Batches</Typography>
              <Tooltip title="Refresh">
                <span>
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={loadBatches}
                    disabled={loadingBatches}
                    sx={{ textTransform: 'none' }}
                  >
                    Refresh
                  </Button>
                </span>
              </Tooltip>
            </Stack>

            {batchError  && <Alert severity="error" sx={{ mb: 2 }}>{batchError}</Alert>}
            {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}

            {loadingBatches && <LinearProgress sx={{ mb: 2 }} />}

            {!loadingBatches && batches.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No batches submitted yet.
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell><strong>Batch ID</strong></TableCell>
                      <TableCell><strong>Submitted By</strong></TableCell>
                      <TableCell><strong>Submitted At</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batches.map(batch => (
                      <BatchRow
                        key={batch.batch_id}
                        batch={batch}
                        fileSlots={fileSlotKeys}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onBatchUpdate={handleBatchUpdate}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

        </Stack>
      </Container>
    </Box>
  );
}
