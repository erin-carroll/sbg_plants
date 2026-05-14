import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Stack, Divider, IconButton, Collapse,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

const MISSING = new Set(['not recorded', 'not collected', 'unknown', 'n/a', '']);
const present  = (v) => v != null && !MISSING.has(String(v).toLowerCase().trim());
const dateStr  = (v) => (v ? String(v).slice(0, 10) : null);

function Row({ label, value, alwaysShow }) {
  if (!alwaysShow && !present(value) && value !== 0) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ py: 0.25 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="caption">{value ?? '—'}</Typography>
    </Stack>
  );
}

function SectionHeader({ title, count, open, onToggle }) {
  return (
    <Stack
      direction="row" alignItems="center" justifyContent="space-between"
      sx={{ cursor: 'pointer', mb: open ? 1 : 0, userSelect: 'none' }}
      onClick={onToggle}
    >
      <Typography variant="subtitle2" color="text.secondary">
        {title} ({count})
      </Typography>
      <IconButton size="small" tabIndex={-1}>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </IconButton>
    </Stack>
  );
}

function GranuleCard({ g, open, onToggle, plotId }) {
  const pixelCount = (g.plot_pixel_map && plotId != null)
    ? (g.plot_pixel_map[String(plotId)] ?? null)
    : null;
  return (
    <Box sx={{ borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
      <Box
        sx={{ px: 1.5, py: 1, cursor: 'pointer', bgcolor: 'grey.50', borderRadius: open ? '4px 4px 0 0' : 1 }}
        onClick={() => onToggle()}
      >
        {/* Row 1: granule ID + chevron */}
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Typography variant="caption" sx={{ fontWeight: 600, fontFamily: 'monospace', wordBreak: 'break-word', flex: 1, mr: 0.5 }}>
            {g.granule_id}
          </Typography>
          <IconButton size="small" tabIndex={-1} sx={{ flexShrink: 0, mt: -0.5 }}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Stack>
        {/* Row 2: date · conditions · px */}
        <Stack direction="row" spacing={1} sx={{ mt: 0.25 }} flexWrap="wrap">
          <Typography variant="caption" color="text.secondary">
            {dateStr(g.acquisition_date) ?? '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            · {g.cloudy_conditions ?? '—'}
          </Typography>
          {pixelCount !== null && (
            <Typography variant="caption" color="text.secondary">· {pixelCount} px</Typography>
          )}
        </Stack>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, bgcolor: 'white' }}>
          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Row label="Campaign" value={g.campaign_name} />
              <Row label="Sensor"   value={g.sensor_name} />
              <Row label="Date"     value={dateStr(g.acquisition_date)} />
              <Row label="Time"     value={g.acquisition_start_time} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Row label="Cloud conditions" value={g.cloudy_conditions ?? '—'} alwaysShow />
              <Row label="Cloud type"     value={present(g.cloud_type)        ? g.cloud_type        : null} />
              <Row label="Pixels"         value={pixelCount} />
            </Box>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}

function PlotSidePanel({ plotId, traits, granules, onClose }) {
  const [traitsOpen, setTraitsOpen] = useState(true);
  const [granulesOpen, setGranulesOpen] = useState(true);
  const [openGranuleIdx, setOpenGranuleIdx] = useState(null);

  useEffect(() => { setOpenGranuleIdx(null); }, [plotId]);

  if (!plotId) return null;

  const plotName = traits[0]?.plot_name;

  return (
    <Paper elevation={2} sx={{ width: '100%', p: 2 }}>
      {/* Header — full width */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {present(plotName) ? plotName : `Plot ${plotId}`}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </Stack>

      <Divider sx={{ mb: 1.5 }} />

      {/* Two-column body */}
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        {/* Left — Trait measurements, slightly narrower */}
        <Box sx={{ flex: '0 0 55%', minWidth: 0 }}>
          <SectionHeader
            title="Trait measurements"
            count={traits.length}
            open={traitsOpen}
            onToggle={() => setTraitsOpen(v => !v)}
          />
          <Collapse in={traitsOpen}>
            {traits.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No trait measurements for this plot.
              </Typography>
            ) : (
              <Box sx={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {[
                        'Trait', 'Value', 'Units', 'Date', 'Sample', 'Taxa',
                        'Veg/Cover type', 'Phenophase', 'FC class', 'FC %',
                        'Canopy pos.', 'Plot veg type', 'Cover method',
                      ].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {traits.map((t, i) => (
                      <TableRow key={i} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{present(t.trait)              ? t.trait              : '—'}</TableCell>
                        <TableCell>                                {t.value != null              ? t.value              : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{present(t.units)              ? t.units              : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateStr(t.collection_date)    ?? '—'                     }</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{present(t.sample_name)        ? t.sample_name        : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{present(t.taxa)               ? t.taxa               : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{present(t.veg_or_cover_type)  ? t.veg_or_cover_type  : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{present(t.phenophase)         ? t.phenophase         : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{present(t.sample_fc_class)    ? t.sample_fc_class    : '—'}</TableCell>
                        <TableCell>                                {t.sample_fc_percent != null  ? t.sample_fc_percent  : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{present(t.canopy_position)    ? t.canopy_position    : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{present(t.plot_veg_type)      ? t.plot_veg_type      : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{present(t.subplot_cover_method) ? t.subplot_cover_method : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Collapse>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Right — Overlapping granules, wider so cards have room */}
        <Box sx={{ flex: '1 1 0%', minWidth: 280 }}>
          <SectionHeader
            title="Overlapping granules"
            count={granules.length}
            open={granulesOpen}
            onToggle={() => setGranulesOpen(v => !v)}
          />
          <Collapse in={granulesOpen}>
            {granules.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No overlapping granules for this plot.
              </Typography>
            ) : (
              <Stack spacing={1} sx={{ maxHeight: 400, overflowY: 'auto', pr: 0.5 }}>
                {granules.map((g, i) => (
                  <GranuleCard
                    key={i}
                    g={g}
                    open={openGranuleIdx === i}
                    onToggle={() => setOpenGranuleIdx(openGranuleIdx === i ? null : i)}
                    plotId={plotId}
                  />
                ))}
              </Stack>
            )}
          </Collapse>
        </Box>
      </Stack>
    </Paper>
  );
}

export default PlotSidePanel;
