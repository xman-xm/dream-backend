import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

try {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
} catch (error) {
    console.warn("Error setting notification handler (likely Expo Go limitation):", error);
}

export function usePushNotifications() {
    const { isAuthenticated } = useAuth();
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const [notification, setNotification] = useState<Notifications.Notification | undefined>();
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);

    const registerForPushNotificationsAsync = async () => {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                // alert('Failed to get push token for push notification!');
                console.log('Permission failed');
                return;
            }

            try {
                const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
                if (!projectId) {
                    // If project ID is missing, we might be in bare workflow or dev, token fetch might fail or return simple string
                    // We just try without project ID for now or grab generic token
                }

                token = (await Notifications.getExpoPushTokenAsync({
                    projectId,
                })).data;

                console.log('Push Token:', token);
                // await storeToken(token); // This will now be handled by the useEffect below
            } catch (e) {
                console.log(e);
            }
        } else {
            console.log('Must use physical device for Push Notifications');
        }

        return token;
    };

    const storeToken = async (token: string) => {
        if (!isAuthenticated) {
            console.log("[DEBUG] Skipping token storage: user not authenticated");
            return;
        }
        try {
            console.log("[DEBUG] Syncing token with server...");
            const res = await apiFetch('/user/push-token', {
                method: 'POST',
                body: JSON.stringify({ token })
            });
            if (res.ok) {
                console.log("[DEBUG] Push token synced successfully");
            } else {
                console.error("[DEBUG] Failed to sync push token", await res.text());
            }
        } catch (error) {
            console.error("[DEBUG] Error syncing push token", error);
        }
    };

    useEffect(() => {
        // Register for push notifications anyway
        registerForPushNotificationsAsync().then(token => {
            setExpoPushToken(token);
        });

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log(response);
        });

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, []);

    // Effect to re-sync when auth state changes or token is fetched
    useEffect(() => {
        if (isAuthenticated && expoPushToken) {
            storeToken(expoPushToken);
        }
    }, [isAuthenticated, expoPushToken]);

    return {
        expoPushToken,
        notification,
    };
}
