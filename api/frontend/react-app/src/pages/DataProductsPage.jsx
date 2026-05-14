import React, { useState, useRef } from 'react';
import {
  Box, Stack, Button, CircularProgress, Alert,
  Typography, Divider, Paper, ToggleButtonGroup, ToggleButton,
  Tooltip, IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Download as DownloadIcon,
  GraphicEq as SpectraIcon,
  RestartAlt as ResetIcon,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';

import Navbar from '../components/Navbar';
import MapView from '../components/MapView';
import LinkedFilterPanel from '../components/LinkedFilterPanel';
import PlotSidePanel from '../components/PlotSidePanel';
import LinkedDataTable from '../components/LinkedDataTable';
import SpectraJobStatus from '../components/SpectraJobStatus';
import JobHistory from '../components/JobHistory';
import AlgorithmPanel from '../components/AlgorithmPanel';
import StagingToggle from '../components/StagingToggle';

import { useLinkedQuery } from '../hooks/useLinkedQuery';
import { useAlgorithmJob } from '../hooks/useAlgorithmJob';
import { useSpectraExtraction } from '../hooks/useSpectraExtraction';
import { ALGORITHM_REGISTRY, DEFAULT_ALGORITHM } from '../config/algorithmConfig';

function DataProductsPage() {
  const q = useLinkedQuery();
  const clearDrawnRef = useRef(null);

  const [selectedAlgorithmKey, setSelectedAlgorithmKey] = useState(DEFAULT_ALGORITHM);
  const [runDisabled,          setRunDisabled]           = useState(false);
  const [filterCollapsed,      setFilterCollapsed]        = useState(false);
  const [extractDisabled,      setExtractDisabled]        = useState(false);
  const [downloadLoading,      setDownloadLoading]        = useState(false);

  const algorithm = ALGORITHM_REGISTRY[selectedAlgorithmKey];

  const job = useAlgorithmJob(
    algorithm,
    q.getPixelRanges,
    q.setError,
    setRunDisabled,
  );

  const spectra = useSpectraExtraction(
    q.getPixelRanges,
    q.setError,
    setExtractDisabled,
  );

  const handleAlgorithmChange = (key) => {
    setSelectedAlgorithmKey(key);
    job.reset();
    setRunDisabled(false);
  };

  const handleDownloadCSV = async () => {
    setDownloadLoading(true);
    try {
      const rows = await q.getMergedDownloadData();
      if (!rows.length) { q.setError('No data to download'); return; }
      const cols = Object.keys(rows[0]);
      const lines = [
        cols.join(','),
        ...rows.map(row =>
          cols.map(c => {
            const val = row[c];
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        ),
      ].join('\n');
      const blob = new Blob(['\uFEFF' + lines], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'linked_query.csv';
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      q.setError(err.message ?? 'Download failed');
    } finally {
      setDownloadLoading(false);
    }
  };

  const hasResults = q.totalPlots > 0 || q.traits.length > 0 || q.granules.length > 0;
  const hasPrev    = q.offset > 0;
  const hasNext    = q.totalPlots > q.offset + q.limit;

  const pixelLabel = q.hasQueried
    ? `${q.pagePixelCount.toLocaleString()} px (page) / ${q.pixelCountLoading ? '…' : (q.totalPixelCount ?? 0).toLocaleString()} px (total)`
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Navbar />

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', mt: '56px', maxWidth: { xl: 1920 }, mx: 'auto', width: '100%' }}>

        {/* Left — filter panel, collapsible */}
        <Box
          sx={{
            width: filterCollapsed ? 48 : { md: 300, lg: 380, xl: 420 },
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            overflowY: filterCollapsed ? 'hidden' : 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.2s ease',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: filterCollapsed ? 'center' : 'flex-end', p: 0.5, flexShrink: 0 }}>
            <Tooltip title={filterCollapsed ? 'Expand filters' : 'Collapse filters'} placement="right">
              <IconButton size="small" onClick={() => setFilterCollapsed(v => !v)}>
                {filterCollapsed ? <ExpandIcon /> : <CollapseIcon />}
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ display: filterCollapsed ? 'none' : 'flex', flexDirection: 'column', gap: 2, px: 2, pb: 2, flex: 1, overflowY: 'auto' }}>
            <StagingToggle onToggle={() => { q.handleReset(); job.reset(); spectra.reset(); setRunDisabled(false); setExtractDisabled(false); clearDrawnRef?.current?.(); }} />

            <LinkedFilterPanel
              campaignName={q.campaignName}
              setCampaignName={q.setCampaignName}
              traitFilters={q.traitFilters}
              setTraitFilters={q.setTraitFilters}
              granuleFilters={q.granuleFilters}
              setGranuleFilters={q.setGranuleFilters}
              geojsonContent={q.geojsonContent}
              setGeojsonContent={q.setUploadedGeojson}
              clearDrawnRef={clearDrawnRef}
            />

            <Divider />

            <Button
              variant="contained"
              startIcon={q.loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
              onClick={q.handleApply}
              disabled={q.loading}
              fullWidth
            >
              Apply
            </Button>

            <Button
              variant="contained"
              color="secondary"
              startIcon={<ResetIcon />}
              onClick={() => {
                q.handleReset();
                job.reset();
                spectra.reset();
                setRunDisabled(false);
                setExtractDisabled(false);
                clearDrawnRef?.current?.();
              }}
              disabled={q.loading}
              fullWidth
            >
              Reset
            </Button>

            {hasResults && (
              <Typography variant="body2" color="text.secondary">
                {q.totalPlots} plots matched
              </Typography>
            )}
          </Box>

          {filterCollapsed && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, pt: 1 }}>
              <Tooltip title="Filters" placement="right">
                <FilterIcon fontSize="small" color="action" />
              </Tooltip>
              {hasResults && (
                <Tooltip title={`${q.totalPlots} plots matched`} placement="right">
                  <Typography variant="caption" color="primary" sx={{ writingMode: 'vertical-rl', fontSize: 10 }}>
                    {q.totalPlots}
                  </Typography>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>

        {/* Right — main content */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>

          {/* Algorithm panel — dropdown + Run button + active job status */}
          <AlgorithmPanel
            selectedAlgorithmKey={selectedAlgorithmKey}
            onAlgorithmChange={handleAlgorithmChange}
            algorithm={algorithm}
            job={job}
            runDisabled={runDisabled || !q.hasQueried || !q.totalPixelCount}
            totalPixelCount={q.totalPixelCount}
          />

          {/* Job history — inherits selected algorithm from AlgorithmPanel */}
          <JobHistory
            selectedAlgorithmKey={selectedAlgorithmKey}
            activeJobId={job.activeJobId}
            onMonitor={(jobId) => {
              job.setActiveJobId(jobId);
              job.setIsPolling(false);
            }}
          />

          {q.error && (
            <Alert severity="error" onClose={() => q.setError(null)}>{q.error}</Alert>
          )}

          {Object.entries(spectra.sensorStatuses ?? {}).some(([, s]) => s.error) && (
            <Alert severity="error">
              {Object.entries(spectra.sensorStatuses)
                .filter(([, s]) => s.error)
                .map(([key, s]) => `${key}: ${s.error}`)
                .join(' | ')}
            </Alert>
          )}

          {q.loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {!q.loading && q.hasQueried && q.totalPlots === 0 && (
            <Alert severity="info">No plots matched your filters.</Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {q.selectedPlotId && (
              <PlotSidePanel
                plotId={q.selectedPlotId}
                traits={q.selectedTraits}
                granules={q.selectedGranules}
                onClose={() => q.setSelectedPlotId(null)}
              />
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <MapView
                mapData={q.mapData}
                filterData={q.filterMapData}
                center={[39.5, -106]}
                zoom={6}
                onFeatureClick={q.setSelectedPlotId}
                selectedPlotId={q.selectedPlotId}
                onShapeDrawn={q.setDrawnGeojson}
                clearDrawnRef={clearDrawnRef}
                drawnShape={q.geojsonContent && q.geojsonIsDrawn ? q.geojsonContent : null}
                height={420}
              />

              {/* Action bar — pagination + spectra extraction + download */}
              {hasResults && (
                <Paper elevation={1} sx={{ px: 2, py: 1.5 }}>
                  {/* Row 1 — pagination */}
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Button size="small" variant="outlined" startIcon={<PrevIcon />}
                      onClick={q.handlePrev} disabled={!hasPrev || q.loading}>
                      Prev
                    </Button>
                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1, textAlign: 'center' }}>
                      {q.displayedOffset + 1}–{Math.min(q.displayedOffset + q.limit, q.totalPlots)} of {q.totalPlots} plots
                    </Typography>
                    <Button size="small" variant="outlined" endIcon={<NextIcon />}
                      onClick={q.handleNext} disabled={!hasNext || q.loading}>
                      Next
                    </Button>
                  </Stack>

                  {/* Row 2 — pixel count + spectra + download */}
                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                    {q.hasQueried && (
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', mr: 1 }}>
                        {pixelLabel}
                      </Typography>
                    )}
                    <Box sx={{ flex: 1 }} />
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
                      Extract Spectra{q.totalPixelCount ? ` (${q.totalPixelCount.toLocaleString()} px)` : ''}
                    </Button>
                    <Button variant="contained" size="small"
                      startIcon={downloadLoading ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
                      onClick={handleDownloadCSV}
                      disabled={downloadLoading || !q.hasQueried}>
                      Download CSV{q.totalCsvRows != null ? ` (${q.totalCsvRows.toLocaleString()} rows)` : q.hasQueried ? ' (…)' : ''}
                    </Button>
                  </Stack>
                </Paper>
              )}

              {/* Spectra extraction job status */}
              <SpectraJobStatus
                jobsBySensor={spectra.jobsBySensor ?? {}}
                sensorStatuses={spectra.sensorStatuses ?? {}}
              />

              {hasResults && (
                <LinkedDataTable
                  traits={q.traits}
                  granules={q.granules}
                  totalTraits={q.totalTraits}
                  totalGranules={q.totalGranules}
                />
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default DataProductsPage;
