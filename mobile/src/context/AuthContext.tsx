import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, removeToken, setToken } from '../lib/auth-store';
import { apiFetch } from '../lib/api';

type User = {
    id: string;
    email: string;
    name?: string;
    image?: string;
};

type AuthContextType = {
    user: User | null;
    isLoading: boolean;
    signIn: (token: string, user: User) => Promise<void>;
    signOut: () => Promise<void>;
    isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    signIn: async () => { },
    signOut: async () => { },
    isAuthenticated: false,
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing session
        const checkSession = async () => {
            try {
                const token = await getToken();
                console.log('UseAuth: Checking session, found token:', token ? 'Yes' : 'No');

                if (token) {
                    try {
                        // Validate token and get user info
                        console.log('UseAuth: Validating token with /user/me');
                        const response = await apiFetch('/user/me', { requiresAuth: true });
                        console.log('UseAuth: /user/me response status:', response.status);

                        if (response.ok) {
                            const data = await response.json();
                            console.log('UseAuth: User data received', data);
                            if (data.user) {
                                setUser(data.user);
                            }
                        } else {
                            // Token might be expired
                            console.log('UseAuth: Token invalid or expired, removing');
                            await removeToken();
                        }
                    } catch (err) {
                        console.log('Failed to fetch user profile', err);
                        // Don't remove token immediately on network error, but maybe prompt login
                    }
                }
            } catch (e) {
                console.error("Session check failed", e);
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();
    }, []);

    const signIn = async (token: string, userData: User) => {
        await setToken(token);
        setUser(userData);
    };

    const signOut = async () => {
        await removeToken();
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                signIn,
                signOut,
                isAuthenticated: !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
