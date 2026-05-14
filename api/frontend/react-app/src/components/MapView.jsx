import React, { useEffect, useRef, useState } from 'react';
import { Paper, Typography, Box, Stack, Chip, IconButton, Collapse, Tooltip } from '@mui/material';
import { Map as MapIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon, CenterFocusStrong as RecenterIcon } from '@mui/icons-material';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { palette } from '../theme';

// Fix leaflet-draw ES module bug: readableArea references bare `type` global.
if (typeof window !== 'undefined' && !window.type) {
  window.type = '';
}

// Fits the map to the bounds of the current GeoJSON data whenever it changes.
// Falls back to setView(center, zoom) when there's no data to fit.
function MapUpdater({ mapData, center, zoom, recenterTrigger }) {
  const map = useMap();

  const fitMap = () => {
    if (!mapData?.features?.length) {
      map.setView([20, 0], 2);
      return;
    }
    try {
      const layer = L.geoJSON(mapData);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    } catch {
      map.setView(center, zoom);
    }
  };

  useEffect(() => { fitMap(); }, [mapData]);           // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (recenterTrigger) fitMap(); }, [recenterTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// FeatureClickHandler — circle markers that scale with zoom + polygons at high zoom.
function FeatureClickHandler({ mapData, onFeatureClick, resultKey }) {
  const map = useMap();
  const polyLayerRef   = useRef(null);
  const markerLayerRef = useRef(null);

  const getRadius = (zoom) => Math.max(4, Math.min(14, zoom - 4));

  useEffect(() => {
    if (!onFeatureClick || !mapData?.features?.length) return;

    if (polyLayerRef.current)   { map.removeLayer(polyLayerRef.current);   polyLayerRef.current   = null; }
    if (markerLayerRef.current) { map.removeLayer(markerLayerRef.current); markerLayerRef.current = null; }

    // Polygon layer — only visible at zoom >= 13
    const polyLayer = L.geoJSON(mapData, {
      style: { weight: 1, color: palette.primary.main, fillColor: palette.primary.main, fillOpacity: 0.2 },
      onEachFeature: (feature, layer) => {
        const plotId = feature.properties?.plot_id ?? feature.properties?.id;
        layer.on('click',     () => { if (plotId != null) onFeatureClick(plotId); });
        layer.on('mouseover', () => layer.setStyle({ weight: 2, fillOpacity: 0.5 }));
        layer.on('mouseout',  () => layer.setStyle({ weight: 1, fillOpacity: 0.25 }));
      },
    });
    if (map.getZoom() >= 13) polyLayer.addTo(map);
    polyLayerRef.current = polyLayer;

    // Circle markers — always visible, radius scales with zoom
    const markerGroup = L.featureGroup();
    mapData.features.forEach((feature) => {
      const plotId = feature.properties?.plot_id ?? feature.properties?.id;
      try {
        const centroid = L.geoJSON(feature).getBounds().getCenter();
        const marker = L.circleMarker(centroid, {
          radius:      getRadius(map.getZoom()),
          weight:      1.5,
          color:       palette.secondary.main,
          fillColor:   palette.secondary.main,
          fillOpacity: 0.5,
        });
        marker.on('click',     () => { if (plotId != null) onFeatureClick(plotId); });
        marker.on('mouseover', () => marker.setStyle({ fillOpacity: 0.3, radius: getRadius(map.getZoom()) + 3 }));
        marker.on('mouseout',  () => marker.setStyle({ fillOpacity: 0.75, radius: getRadius(map.getZoom()) }));
        markerGroup.addLayer(marker);
      } catch { /* skip */ }
    });
    markerGroup.addTo(map);
    markerGroup.bringToFront();
    markerLayerRef.current = markerGroup;

    // Update radius + polygon visibility on zoom
    const onZoom = () => {
      const zoom = map.getZoom();
      const r = getRadius(zoom);
      markerGroup.eachLayer(m => m.setRadius(r));
      if (zoom >= 13) {
        if (!map.hasLayer(polyLayer)) polyLayer.addTo(map);
      } else {
        if (map.hasLayer(polyLayer)) map.removeLayer(polyLayer);
      }
      markerGroup.bringToFront();
    };
    map.on('zoomend', onZoom);

    return () => {
      map.off('zoomend', onZoom);
      if (polyLayerRef.current)   { map.removeLayer(polyLayerRef.current);   polyLayerRef.current   = null; }
      if (markerLayerRef.current) { map.removeLayer(markerLayerRef.current); markerLayerRef.current = null; }
    };
  }, [mapData, onFeatureClick, resultKey, map]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// DrawControl — adds Leaflet Draw polygon/rectangle toolbar.
function DrawControl({ onShapeDrawn, clearRef, showRef }) {
  const map = useMap();
  const drawnItemsRef = useRef(null);

  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    // Expose a clear function so the panel Clear button can wipe the drawn layer.
    if (clearRef) {
      clearRef.current = () => {
        drawnItems.clearLayers();
      };
    }

    // Expose a show/hide toggle for the toolbar chip.
    if (showRef) {
      showRef.current = (visible) => {
        if (visible) {
          if (!map.hasLayer(drawnItems)) map.addLayer(drawnItems);
        } else {
          if (map.hasLayer(drawnItems)) map.removeLayer(drawnItems);
        }
      };
    }

    const drawControl = new L.Control.Draw({
      draw: {
        polygon:      { allowIntersection: false, shapeOptions: { color: palette.success.main, fillColor: palette.success.main, fillOpacity: 0.5 } },
        rectangle:    { shapeOptions: { color: palette.success.main, fillColor: palette.success.main, fillOpacity: 0.5 } },
        circle:       false,
        marker:       false,
        polyline:     false,
        circlemarker: false,
      },
      edit: { featureGroup: drawnItems },
    });
    map.addControl(drawControl);

    const onCreate = (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      map.dragging.enable();
      onShapeDrawn(e.layer.toGeoJSON().geometry);
    };

    const onDeleted = () => {
      map.dragging.enable();
      onShapeDrawn(null);
    };

    const onDrawStart = () => { map.dragging.disable(); };
    const onDrawStop  = () => { map.dragging.enable(); };

    map.on(L.Draw.Event.CREATED,    onCreate);
    map.on(L.Draw.Event.DELETED,    onDeleted);
    map.on(L.Draw.Event.DRAWSTART,  onDrawStart);
    map.on(L.Draw.Event.DRAWSTOP,   onDrawStop);

    return () => {
      map.off(L.Draw.Event.CREATED,   onCreate);
      map.off(L.Draw.Event.DELETED,   onDeleted);
      map.off(L.Draw.Event.DRAWSTART, onDrawStart);
      map.off(L.Draw.Event.DRAWSTOP,  onDrawStop);
      map.dragging.enable();
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
      drawnItemsRef.current = null;
      if (clearRef) clearRef.current = null;
      if (showRef)  showRef.current  = null;
    };
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// Style for query results — default Leaflet blue
const RESULT_STYLE = {};

// Style for uploaded GeoJSON filter boundary
const FILTER_STYLE = {
  color:       '#0D3E70',
  weight:      2,
  opacity:     1,
  fillColor:   '#436B9B',
  fillOpacity: 0.4,
};

/**
 * MapView
 *
 * Props (all optional):
 *   mapData          : GeoJSON FeatureCollection — query results
 *   filterData       : GeoJSON FeatureCollection — filter boundary
 *   center           : [lat, lng]
 *   zoom             : number
 *   defaultCollapsed : bool
 *   height           : number (px)
 *   onFeatureClick   : (plotId) => void  — called when a result feature is clicked
 *   onShapeDrawn     : (geojson) => void — called when user draws/uploads a polygon
 */
function MapView({
  mapData, filterData, center, zoom,
  defaultCollapsed = false, height = 500,
  onFeatureClick, onShapeDrawn, clearDrawnRef, drawnShape,
}) {
  const [resultKey, setResultKey]       = useState(0);
  const [filterKey, setFilterKey]       = useState(0);
  const [showResults, setShowResults]   = useState(true);
  const [showFilter, setShowFilter]     = useState(true);
  const [showDrawn, setShowDrawn]       = useState(true);
  const [collapsed, setCollapsed]       = useState(defaultCollapsed);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const showDrawnRef = useRef(null);

  useEffect(() => { if (mapData)    { setResultKey(prev => prev + 1); setShowResults(true); } }, [mapData]);
  useEffect(() => { if (filterData) { setFilterKey(prev => prev + 1); setShowFilter(true);  } }, [filterData]);
  useEffect(() => { if (drawnShape) { setShowDrawn(true); showDrawnRef.current?.(true); } }, [drawnShape]);

  const handleToggleDrawn = () => {
    const next = !showDrawn;
    setShowDrawn(next);
    showDrawnRef.current?.(next);
  };

  return (
    <Paper elevation={2} sx={{ mb: 3, overflow: 'hidden' }}>
      <Box sx={{ bgcolor: 'grey.100', p: 2, borderBottom: collapsed ? 'none' : '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <MapIcon color="primary" />
          <Typography variant="h6">Map View</Typography>
          {mapData && !collapsed && (
            <Typography variant="caption" color="text.secondary">
              {mapData.features?.length || 0} features
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          {!collapsed && (
            <Tooltip title="Recenter map">
              <IconButton size="small" onClick={() => setRecenterTrigger(v => v + 1)} sx={{ '&:hover': { bgcolor: '#CE9E4A', color: '#ffffff' } }}>
                <RecenterIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {!collapsed && drawnShape && (
            <Chip
              label="Drawn area"
              size="small"
              onClick={handleToggleDrawn}
              sx={{
                bgcolor:    showDrawn ? 'success.main' : 'transparent',
                color:      showDrawn ? 'success.contrastText' : 'success.main',
                border:     '1px solid',
                borderColor: 'success.main',
                cursor:     'pointer',
                fontWeight: 500,
                '&:hover': { bgcolor: '#36633A', borderColor: '#36633A', color: '#ffffff' },
              }}
            />
          )}
          {!collapsed && filterData && (
            <Chip
              label="Filter boundary"
              size="small"
              onClick={() => setShowFilter(v => !v)}
              sx={{
                bgcolor:    showFilter ? '#0D3E70' : 'transparent',
                color:      showFilter ? '#ffffff' : '#0D3E70',
                border:     '1px solid',
                borderColor: '#0D3E70',
                cursor:     'pointer',
                fontWeight: 500,
                '&:hover': { bgcolor: '#1A2A42', borderColor: '#1A2A42', color: '#ffffff' },
              }}
            />
          )}
          {!collapsed && mapData && (
            <Chip
              label="Query results"
              size="small"
              onClick={() => setShowResults(v => !v)}
              sx={{
                bgcolor:    showResults ? 'secondary.main' : 'transparent',
                color:      showResults ? 'secondary.contrastText' : 'secondary.main',
                border:     '1px solid',
                borderColor: 'secondary.main',
                cursor:     'pointer',
                fontWeight: 500,
                '&:hover': { bgcolor: '#087099', borderColor: '#087099', color: '#ffffff' },
              }}
            />
          )}
          <IconButton size="small" onClick={() => setCollapsed(v => !v)}>
            {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        </Stack>
      </Box>
      <Collapse in={!collapsed}>
        <Box sx={{ height }}>
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <MapUpdater mapData={mapData ?? filterData} center={center} zoom={zoom} recenterTrigger={recenterTrigger} />

            {onShapeDrawn && <DrawControl onShapeDrawn={onShapeDrawn} clearRef={clearDrawnRef} showRef={showDrawnRef} />}

            {filterData && showFilter && (
              <GeoJSON data={filterData} key={filterKey} style={FILTER_STYLE} />
            )}

            {mapData && showResults && !onFeatureClick && (
              <GeoJSON data={mapData} key={resultKey} style={RESULT_STYLE} />
            )}
            {mapData && showResults && onFeatureClick && (
              <FeatureClickHandler
                mapData={mapData}
                onFeatureClick={onFeatureClick}
                resultKey={resultKey}
              />
            )}
          </MapContainer>
        </Box>
      </Collapse>
    </Paper>
  );
}

export default MapView;
