import { useState } from 'react';
import { extractSpectra } from '../utils/api';
import { useJobPolling } from './useJobPolling';
import { useSchema } from '../context/SchemaContext';

export function useSpectraExtraction(getPixelRanges, setError, setExtractDisabled) {
  const { schema } = useSchema();
  const [jobsBySensor, setJobsBySensor] = useState({});
  const [isPolling, setIsPolling]       = useState(false);
  const [spectraType, setSpectraType]   = useState('radiance');

  const onAllComplete = () => {
    setIsPolling(false);
    setExtractDisabled(false);
  };

  const { sensorStatuses, resetStatuses } = useJobPolling(jobsBySensor, isPolling, onAllComplete);

  const handleExtractSpectra = async () => {
    setError(null);
    try {
      const pixelRangesBySensor = await getPixelRanges();
      const jobs = await extractSpectra(pixelRangesBySensor, spectraType, schema);
      resetStatuses();
      setJobsBySensor(jobs);
      setIsPolling(true);
      setExtractDisabled(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const reset = () => {
    resetStatuses();
    setJobsBySensor({});
    setIsPolling(false);
  };

  return {
    jobsBySensor,
    sensorStatuses,
    isPolling,
    spectraType,
    setSpectraType,
    handleExtractSpectra,
    reset,
  };
}
