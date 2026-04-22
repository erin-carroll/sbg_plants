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
  PlayArrow as RunIcon,
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
import IsoFitStatus from '../components/IsoFitStatus';
import IsoFitHistory from '../components/IsoFitHistory';

import { useLinkedQuery } from '../hooks/useLinkedQuery';
import { useIsoFitJob } from '../hooks/useIsoFitJob';

function IsoFitPage() {
  const q = useLinkedQuery();
  const clearDrawnRef = useRef(null);

  const [isoFitDisabled, setIsoFitDisabled] = useState(false);
  const [filterCollapsed, setFilterCollapsed] = useState(false);

  const isofit = useIsoFitJob(
    q.getPixelRanges,
    q.setError,
    setIsoFitDisabled,
  );

  const hasResults = q.totalPlots > 0 || q.traits.length > 0 || q.granules.length > 0;
  const hasPrev    = q.offset > 0;
  const hasNext    = q.totalPlots > q.offset + q.limit;

  const pixelLabel = q.hasQueried
    ? `${q.pagePixelCount.toLocaleString()} px (page) / ${q.pixelCountLoading ? '…' : (q.totalPixelCount ?? 0).toLocaleString()} px (total)`
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Navbar />

      {/* Two-column body */}
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
              onClick={() => { q.handleReset(); isofit.reset(); setIsoFitDisabled(false); clearDrawnRef?.current?.(); }}
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

        {/* Right — IsoFit panels + map + table */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>

          {/* IsoFit job monitoring + history — always at top */}
          <IsoFitStatus
            parentJobId={isofit.isoFitJobId}
            isPolling={isofit.isIsoFitPolling}
            onStopPolling={() => isofit.setIsIsoFitPolling(false)}
            onStartPolling={() => isofit.setIsIsoFitPolling(true)}
            onClose={() => { isofit.setIsIsoFitPolling(false); isofit.setActiveJobId(null); }}
          />
          <IsoFitHistory
            activeJobId={isofit.isoFitJobId}
            onMonitor={(jobId) => {
              isofit.setActiveJobId(jobId);
              isofit.setIsIsoFitPolling(false);
            }}
          />

          {q.error && (
            <Alert severity="error" onClose={() => q.setError(null)}>{q.error}</Alert>
          )}

          {q.loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {!q.loading && q.hasQueried && q.totalPlots === 0 && (
            <Alert severity="info">No plots matched your filters.</Alert>
          )}

          {/* Main content */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Plot detail panel — shown above map when a plot is selected */}
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

              {/* Action bar */}
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
                  {/* Row 2 — pixel count + actions */}
                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                    {q.hasQueried && (
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', mr: 1 }}>
                        {pixelLabel}
                      </Typography>
                    )}
                    <Box sx={{ flex: 1 }} />
                    <ToggleButtonGroup value="radiance" exclusive size="small">
                      <ToggleButton value="radiance" sx={{ textTransform: 'none', fontSize: 12 }}>Radiance</ToggleButton>
                      <ToggleButton value="reflectance" disabled sx={{ textTransform: 'none', fontSize: 12 }}>Reflectance</ToggleButton>
                    </ToggleButtonGroup>
                    <Button
                      variant="contained"
                      size="small"
                      color="error"
                      startIcon={<RunIcon />}
                      onClick={() => {
                        if (!window.confirm('Are you sure you want to run ISOFIT?')) return;
                        isofit.handleRunIsoFit();
                      }}
                      disabled={isoFitDisabled || isofit.isIsoFitPolling || !q.hasQueried}
                    >
                      Run ISOFIT
                    </Button>
                  </Stack>
                </Paper>
              )}

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

export default IsoFitPage;
