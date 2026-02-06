import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { networkStore } from '../lib/network-store';
import { networkEvents } from '../lib/network-events';
import { API_URL } from '../lib/api';

type NetworkContextType = {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    isServerReachable: boolean | null;
    checkServerReachability: () => Promise<void>;
};

const NetworkContext = createContext<NetworkContextType>({
    isConnected: true,
    isInternetReachable: true,
    isServerReachable: true,
    checkServerReachability: async () => { },
});

export const useNetworkStatus = () => useContext(NetworkContext);

interface NetworkProviderProps {
    children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
    const netInfo = useNetInfo();
    const [isServerReachable, setIsServerReachable] = useState<boolean | null>(true);

    // Sync NetInfo with Store
    useEffect(() => {
        networkStore.setIsConnected(netInfo.isConnected);
    }, [netInfo.isConnected]);

    // Subscribe to API Events
    useEffect(() => {
        const unsubscribeUp = networkEvents.on('SERVER_UP', () => {
            // Only update if state changes to avoid re-renders
            setIsServerReachable(prev => {
                if (prev !== true) {
                    networkStore.setIsServerReachable(true);
                    return true;
                }
                return prev;
            });
        });

        const unsubscribeDown = networkEvents.on('SERVER_DOWN', () => {
            setIsServerReachable(prev => {
                if (prev !== false) {
                    networkStore.setIsServerReachable(false);
                    return false;
                }
                return prev;
            });
        });

        return () => {
            unsubscribeUp();
            unsubscribeDown();
        };
    }, []);

    const checkServerReachability = async () => {
        // Validation check for manual retry
        if (netInfo.isConnected === false) return;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            // Just fetching root or health to trigger the apiFetch logic
            // We use fetch directly here to avoid circular dependency loop if apiFetch depends on Context (it doesn't, it depends on Store)
            // But actually apiFetch updates the events, so we SHOULD use a mechanism that triggers events.
            // But api.ts imports store/events, not context. context imports store/events. So calls are fine.
            // Let's use a raw fetch here but emit events manually, OR just call a dummy endpoint.

            await fetch(`${API_URL}/health`, {
                method: 'GET',
                signal: controller.signal
            }).then(response => {
                if (response.ok || response.status === 404) {
                    networkEvents.emit('SERVER_UP');
                } else {
                    // 500 is technically reachable, but maybe we want to verify "healthy"
                    networkEvents.emit('SERVER_UP');
                }
            }).catch(e => {
                networkEvents.emit('SERVER_DOWN');
            });

            clearTimeout(timeoutId);
        } catch (error) {
            networkEvents.emit('SERVER_DOWN');
        }
    };

    return (
        <NetworkContext.Provider
            value={{
                isConnected: netInfo.isConnected,
                isInternetReachable: netInfo.isInternetReachable,
                isServerReachable,
                checkServerReachability
            }}
        >
            {children}
        </NetworkContext.Provider>
    );
};
