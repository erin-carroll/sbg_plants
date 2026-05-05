import { useState } from 'react';
import { submitAlgorithmRun } from '../utils/api';

/**
 * Manages submission and active tracking for any registered algorithm job.
 * Algorithm-agnostic — behaviour is driven by the algorithm config object
 * from ALGORITHM_REGISTRY.
 *
 * @param {object} algorithm  - Entry from ALGORITHM_REGISTRY
 * @param {function} getPixelRanges  - Async fn that returns pixel_ranges payload
 * @param {function} setError        - Error state setter from parent
 * @param {function} setRunDisabled  - Disables the Run button after submission
 */
export function useAlgorithmJob(algorithm, getPixelRanges, setError, setRunDisabled) {
  const [activeJobId, setActiveJobId]   = useState(null);
  const [isPolling,   setIsPolling]     = useState(false);

  const handleRun = async () => {
    setError(null);
    try {
      const pixelRanges = await getPixelRanges();
      const response    = await submitAlgorithmRun(algorithm, { pixel_ranges: pixelRanges });
      const id          = response.data.parent_job_id || response.data.job_id;
      setActiveJobId(id);
      setIsPolling(true);
      setRunDisabled(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const reset = () => {
    setActiveJobId(null);
    setIsPolling(false);
  };

  return {
    activeJobId,
    isPolling,
    setIsPolling,
    setActiveJobId,
    handleRun,
    reset,
  };
}
