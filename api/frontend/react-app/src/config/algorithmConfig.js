/**
 * Algorithm registry — the single place to register a new data product algorithm.
 *
 * Adding a new algorithm requires only:
 *   1. Add an entry here
 *   2. Add a matching entry in the backend PRODUCT_REGISTRY (promote.py)
 *   3. Implement the Batch worker that writes to the staging table
 *
 * Everything else — job submission, status polling, history, promotion — is
 * algorithm-agnostic and reuses the same components and API calls.
 */

export const ALGORITHM_REGISTRY = {
  isofit: {
    label:                 'ISOFIT',
    description:           'Atmospheric correction → per-pixel reflectance',
    apiEndpoint:           '/run_algorithm',
    jobType:               'isofit_parent',
    productKey:            'isofit',
    downloadView:          'reflectance_view',
    downloadSpectralColumn: 'reflectance',
  },

  // Future algorithms — add one entry here, nothing else changes:
  //
  // fractional_cover: {
  //   label:       'Fractional Cover',
  //   description: 'Fractional cover classification + canopy water content',
  //   apiEndpoint: '/run_fractional_cover',
  //   jobType:     'fc_parent',
  //   productKey:  'fractional_cover',
  // },
};

export const DEFAULT_ALGORITHM = 'isofit';
