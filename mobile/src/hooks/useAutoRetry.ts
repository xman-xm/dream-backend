import { useEffect, useRef } from 'react';
import { useNetworkStatus } from '../context/NetworkContext';

/**
 * Triggers callback when network comes back online (isConnected changes from false to true)
 * or server becomes reachable.
 */
export function useAutoRetry(callback: () => void) {
    const { isConnected, isServerReachable } = useNetworkStatus();
    const prevConnected = useRef(isConnected);
    const prevServerReachable = useRef(isServerReachable);

    useEffect(() => {
        // Check if we gained connection
        const cameOnline = !prevConnected.current && isConnected;
        const serverCameUp = !prevServerReachable.current && isServerReachable;

        if ((cameOnline || serverCameUp) && isConnected && isServerReachable) {
            console.log('[AutoRetry] Triggering retry');
            callback();
        }

        prevConnected.current = isConnected;
        prevServerReachable.current = isServerReachable;
    }, [isConnected, isServerReachable, callback]);
}
