import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNetworkStatus } from '../context/NetworkContext';
import { Ionicons } from '@expo/vector-icons';

interface OfflineWrapperProps {
    children: ReactNode;
    onRetry?: () => void;
}

export const OfflineWrapper: React.FC<OfflineWrapperProps> = ({ children, onRetry }) => {
    const { isConnected, isServerReachable } = useNetworkStatus();

    // Determine state
    const isOffline = isConnected === false;
    const isServerDown = isConnected === true && isServerReachable === false;

    // If online (or initial loading state where null might occur), show content
    if (!isOffline && !isServerDown) {
        return <>{children}</>;
    }

    const message = "No Internet Connection";
    const subMessage = "Please check your connection.";

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="wifi" size={64} style={{ opacity: 0.3 }} color="#000" />
                    {/* Cut slash simulation */}
                    <View style={[styles.slash, { transform: [{ rotate: '45deg' }] }]} />
                </View>
                <Text style={styles.title}>{message}</Text>
                <Text style={styles.subtitle}>{subMessage}</Text>

                {onRetry && (
                    <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        padding: 20,
    },
    iconContainer: {
        marginBottom: 20,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    slash: {
        position: 'absolute',
        width: '60%',
        height: 4,
        borderRadius: 2,
        backgroundColor: '#000',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryText: {
        color: '#fff',
        fontWeight: 'bold',
    }
});
