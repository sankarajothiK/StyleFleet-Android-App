import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';

/**
 * Pull-to-refresh control for a screen's main list/scroll view.
 * Returns undefined when the screen has no refresh handler, so it can be
 * passed straight to `refreshControl`.
 */
export const usePullRefresh = (onRefresh?: () => Promise<void>) => {
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      await onRefresh();
    } catch {
      // The loader surfaces its own errors; just stop the spinner.
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [onRefresh]);

  if (!onRefresh) return undefined;
  return <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />;
};
