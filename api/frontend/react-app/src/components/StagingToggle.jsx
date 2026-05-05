import React from 'react';
import { Alert, FormControlLabel, Switch, Box } from '@mui/material';
import { useSchema } from '../context/SchemaContext';
import { useIsAdmin } from '../hooks/useIsAdmin';

/**
 * StagingToggle — renders a switch to flip between production and staging
 * schemas, followed by a persistent warning banner when staging is active.
 *
 * Only rendered for admin and superadmin users; invisible to regular users.
 */
export default function StagingToggle() {
  const { isAdmin } = useIsAdmin();
  const { isStaging, setSchema } = useSchema();

  if (!isAdmin) return null;

  return (
    <Box sx={{ mb: isStaging ? 0 : 1 }}>
      <FormControlLabel
        control={
          <Switch
            checked={isStaging}
            onChange={(e) => setSchema(e.target.checked ? 'staging' : 'production')}
            color="info"
            size="small"
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: isStaging ? 'info.main' : 'text.secondary' }}>
            Preview staging data
          </Box>
        }
        sx={{ ml: 0 }}
      />
      {isStaging && (
        <Alert severity="info" sx={{ mt: 0.5 }}>
          Viewing <strong>staging data</strong> — results reflect unpromoted ingestion batches
          and may not match the production database.
        </Alert>
      )}
    </Box>
  );
}
