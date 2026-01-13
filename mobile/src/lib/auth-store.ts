import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'user_jwt_token';

export async function setToken(token: string) {
    try {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
        console.error('Error setting token:', error);
    }
}

export async function getToken() {
    try {
        return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
        console.error('Error getting token:', error);
        return null;
    }
}

export async function removeToken() {
    try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
        console.error('Error removing token:', error);
    }
}
