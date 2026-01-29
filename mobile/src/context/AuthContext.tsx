import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, removeToken, setToken } from '../lib/auth-store';
import { apiFetch } from '../lib/api';

type User = {
    id: string;
    email: string;
    name?: string;
    image?: string;
    avatarUrl?: string;
    username?: string;
    bio?: string;
    _count?: {
        posts: number;
        friends: number;
    };
};

type AuthContextType = {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    signIn: (token: string, user: User) => Promise<void>;
    signOut: () => Promise<void>;
    refreshUserProfile: () => Promise<void>;
    isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    isLoading: true,
    signIn: async () => { },
    signOut: async () => { },
    refreshUserProfile: async () => { },
    isAuthenticated: false,
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [token, setTokenState] = useState<string | null>(null);

    const fetchUserProfile = async () => {
        try {
            const response = await apiFetch('/user/me', { requiresAuth: true });
            if (response.ok) {
                const data = await response.json();
                if (data.user) {
                    setUser(data.user);
                }
            }
        } catch (err) {
            console.log('Failed to fetch user profile', err);
        }
    };

    useEffect(() => {
        // Check for existing session
        const checkSession = async () => {
            try {
                const storedToken = await getToken();
                console.log('UseAuth: Checking session, found token:', storedToken ? 'Yes' : 'No');

                if (storedToken) {
                    setTokenState(storedToken);
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
                            setTokenState(null);
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

    const signIn = async (newToken: string, userData: User) => {
        await setToken(newToken);
        setTokenState(newToken);
        setUser(userData);
    };

    const signOut = async () => {
        await removeToken();
        setTokenState(null);
        setUser(null);
    };

    const refreshUserProfile = async () => {
        await fetchUserProfile();
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading,
                signIn,
                signOut,
                refreshUserProfile,
                isAuthenticated: !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
