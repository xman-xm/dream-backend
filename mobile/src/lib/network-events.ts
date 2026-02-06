type NetworkEventType = 'SERVER_UP' | 'SERVER_DOWN';
type Listener = () => void;

class NetworkEventEmitter {
    private listeners: Record<NetworkEventType, Listener[]> = {
        'SERVER_UP': [],
        'SERVER_DOWN': []
    };

    on(event: NetworkEventType, listener: Listener) {
        this.listeners[event].push(listener);
        return () => {
            this.listeners[event] = this.listeners[event].filter(l => l !== listener);
        };
    }

    emit(event: NetworkEventType) {
        this.listeners[event].forEach(listener => listener());
    }
}

export const networkEvents = new NetworkEventEmitter();
