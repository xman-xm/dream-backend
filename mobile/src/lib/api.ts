import { getToken } from './auth-store';
import { Platform } from 'react-native';

// For Android Emulator, use 10.0.2.2. For iOS Simulator/Web/Physical Device, use localhost or IP.
// Since we are running on the same machine, localhost usually works for iOS Simulator.
// For Android Emulator, we need to be careful.
const DEV_API_URL = Platform.select({
    android: 'http://10.0.2.2:3000/api', // Android Emulator
    ios: 'http://localhost:3000/api',     // iOS Simulator
    default: 'http://localhost:3000/api',  // Web
});

export const API_URL = process.env.EXPO_PUBLIC_API_URL || DEV_API_URL;

type FetchOptions = RequestInit & {
    requiresAuth?: boolean;
};

import { networkStore } from './network-store';
import { networkEvents } from './network-events';

// ... (other imports)

export async function apiFetch(endpoint: string, options: FetchOptions = {}) {
    // 1. Connectivity Guard
    const status = networkStore.get();
    if (status.isConnected === false) {
        // Fail fast if we know we have no internet
        console.log('[Mobile API] Blocking request due to offline status');
        throw new Error('Network request blocked: No Internet Connection');
    }

    // Note: We might allow requests if isServerReachable is false, to allowed "retry" logic or discovery that it's back up.
    // Or we can block those too. The user said "show a wifi cut icon instead of lunching the request".
    // If we show the icon, the user likely can't trigger the request (UI blocked).
    // But if they somehow do, we should probably block it or let it try to see if server is back.
    // Let's let it try if internet is connected, so we can detect SERVER_UP.

    const { requiresAuth = true, headers, ...rest } = options;

    const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };

    if (requiresAuth) {
        const token = await getToken();
        if (token) {
            // @ts-ignore
            defaultHeaders['Authorization'] = `Bearer ${token}`;
        }
    }

    if (rest.body instanceof FormData) {
        // @ts-ignore
        delete defaultHeaders['Content-Type'];
    }

    const config = {
        ...rest,
        headers: {
            ...defaultHeaders,
            ...headers,
        },
    };

    try {
        const fullUrl = `${API_URL}${endpoint}`;
        console.log(`[Mobile API] Requesting: ${fullUrl}`);
        const response = await fetch(fullUrl, config);
        console.log(`[Mobile API] Response ${endpoint}: ${response.status}`);

        // Success (technically response received)
        networkEvents.emit('SERVER_UP');

        return response;
    } catch (error) {
        console.error(`API Request Error ${endpoint}:`, error);

        // Check if it's a network error
        // fetch throws TypeError for network errors
        if (error instanceof TypeError || (error as any).message?.includes('Network request failed')) {
            networkEvents.emit('SERVER_DOWN');
        }

        throw error;
    }
}
