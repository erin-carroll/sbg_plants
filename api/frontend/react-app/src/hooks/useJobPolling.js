import { useState, useEffect, useRef, useCallback } from 'react';
import { pollJobStatus } from '../utils/api';

export function useJobPolling(jobsBySensor, isPolling, onAllComplete) {
  const [sensorStatuses, setSensorStatuses] = useState({});
  const intervalsRef = useRef({});

  const resetStatuses = useCallback(() => {
    setSensorStatuses({});
  }, []);

  useEffect(() => {
    Object.values(intervalsRef.current).forEach(clearInterval);
    intervalsRef.current = {};

    if (!isPolling || !jobsBySensor || Object.keys(jobsBySensor).length === 0) return;

    setSensorStatuses(
      Object.fromEntries(
        Object.keys(jobsBySensor).map(key => [key, { status: 'queued', rowsProcessed: 0, downloadUrl: null, error: null }])
      )
    );

    const totalJobs = Object.keys(jobsBySensor).length;
    let completedJobs = 0;

    Object.entries(jobsBySensor).forEach(([sensorKey, jobId]) => {
      const poll = async () => {
        try {
          const result = await pollJobStatus(jobId);
          const isFailed   = result.status === 'failed';
          const isComplete = !!result.presigned_url;
          const status = isFailed ? 'failed' : isComplete ? 'complete' : result.status === 'queued' ? 'queued' : 'running';

          setSensorStatuses(prev => ({
            ...prev,
            [sensorKey]: {
              status,
              rowsProcessed: result.rows_processed || 0,
              downloadUrl: result.presigned_url || null,
              error: isFailed ? 'Job failed — the query returned no results or an error occurred.' : null,
            }
          }));

          if (isComplete || isFailed) {
            clearInterval(intervalsRef.current[sensorKey]);
            delete intervalsRef.current[sensorKey];
            completedJobs += 1;
            if (completedJobs >= totalJobs && onAllComplete) {
              onAllComplete();
            }
          }
        } catch (err) {
          setSensorStatuses(prev => ({
            ...prev,
            [sensorKey]: { ...prev[sensorKey], status: 'failed', error: err.message }
          }));
          clearInterval(intervalsRef.current[sensorKey]);
          delete intervalsRef.current[sensorKey];
          completedJobs += 1;
          if (completedJobs >= totalJobs && onAllComplete) {
            onAllComplete();
          }
        }
      };

      poll();
      intervalsRef.current[sensorKey] = setInterval(poll, 2000);
    });

    return () => {
      Object.values(intervalsRef.current).forEach(clearInterval);
      intervalsRef.current = {};
    };
  }, [isPolling, jobsBySensor]);

  return { sensorStatuses, resetStatuses };
}