import React from 'react';
import {
  Paper, Typography, Button, Box, Stack,
  ToggleButtonGroup, ToggleButton, CircularProgress,
} from '@mui/material';
import {
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Download as DownloadIcon,
  Biotech as SpectraIcon,
} from '@mui/icons-material';

/**
 * SpectraControls
 *
 * Renders the pagination row + pixel count + spectra type toggle + action buttons.
 * Used on DataProductsPage and LinkedQueryPage.
 *
 * Props:
 *   q                  — query state object (handlePrev, handleNext, displayedOffset, limit, totalPlots, hasQueried, pagePixelCount, pixelCountLoading, totalPixelCount, totalCsvRows, loading)
 *   spectra            — spectra state object (spectraType, setSpectraType, handleExtractSpectra, isPolling)
 *   hasPrev            — bool
 *   hasNext            — bool
 *   extractDisabled    — bool
 *   downloadLoading    — bool
 *   onDownloadCSV      — () => void
 *   isMobile           — bool
 */
export default function SpectraControls({
  q, spectra, hasPrev, hasNext,
  extractDisabled, downloadLoading, onDownloadCSV, isMobile,
}) {
  return (
    <Paper elevation={1} sx={{ px: { xs: 1, sm: 2 }, py: 1.5 }}>
      {/* Row 1 — pagination */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Button size="small" variant="outlined" startIcon={<PrevIcon />}
          onClick={q.handlePrev} disabled={!hasPrev || q.loading}>
          Prev
        </Button>
        <Typography variant="body2" color="text.secondary"
          sx={{ flex: 1, textAlign: 'center', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
          {q.displayedOffset + 1}–{Math.min(q.displayedOffset + q.limit, q.totalPlots)} of {q.totalPlots} plots
        </Typography>
        <Button size="small" variant="outlined" endIcon={<NextIcon />}
          onClick={q.handleNext} disabled={!hasNext || q.loading}>
          Next
        </Button>
      </Stack>

      {/* Rows 2 + 3 — centered */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, pt: 0.5 }}>
        {/* Row 2 — pixel count */}
        <Typography variant="caption" color="text.secondary" sx={{ minHeight: '1.2em' }}>
          {q.hasQueried
            ? `${q.pagePixelCount.toLocaleString()} px (page) / ${q.pixelCountLoading ? '…' : (q.totalPixelCount ?? 0).toLocaleString()} px (total)`
            : ' '}
        </Typography>

        {/* Row 3 — toggle + buttons */}
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
          <ToggleButtonGroup
            value={spectra.spectraType}
            exclusive
            onChange={(_, v) => { if (v) spectra.setSpectraType(v); }}
            size="small"
          >
            <ToggleButton value="radiance"    sx={{ textTransform: 'none', fontSize: 12 }}>Radiance</ToggleButton>
            <ToggleButton value="reflectance" sx={{ textTransform: 'none', fontSize: 12 }}>Reflectance</ToggleButton>
          </ToggleButtonGroup>
          <Button variant="contained" size="small" color="secondary" startIcon={<SpectraIcon />}
            onClick={spectra.handleExtractSpectra}
            disabled={extractDisabled || spectra.isPolling || !q.hasQueried}>
            {isMobile ? 'Extract' : `Extract Spectra${q.totalPixelCount ? ` (${q.totalPixelCount.toLocaleString()} px)` : ''}`}
          </Button>
          <Button variant="contained" size="small"
            startIcon={downloadLoading ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
            onClick={onDownloadCSV} disabled={downloadLoading || !q.hasQueried}>
            {isMobile ? 'CSV' : `Download CSV${q.totalCsvRows != null ? ` (${q.totalCsvRows.toLocaleString()} rows)` : q.hasQueried ? ' (…)' : ''}`}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
