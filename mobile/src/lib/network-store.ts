type NetworkStatus = {
    isConnected: boolean | null;
    isServerReachable: boolean | null;
};

let status: NetworkStatus = {
    isConnected: true,
    isServerReachable: true,
};

export const networkStore = {
    get: () => status,
    set: (newStatus: NetworkStatus) => {
        status = newStatus;
    },
    setIsConnected: (connected: boolean | null) => {
        status.isConnected = connected;
    },
    setIsServerReachable: (reachable: boolean | null) => {
        status.isServerReachable = reachable;
    }
};
