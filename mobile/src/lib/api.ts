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

export async function apiFetch(endpoint: string, options: FetchOptions = {}) {
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

    const config = {
        ...rest,
        headers: {
            ...defaultHeaders,
            ...headers,
        },
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        return response;
    } catch (error) {
        console.error(`API Request Error ${endpoint}:`, error);
        throw error;
    }
}
