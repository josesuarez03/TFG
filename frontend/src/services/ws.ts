class WebSocketService {
    private socket: WebSocket | null = null;
    private listeners: ((message: string) => void)[] = [];
    private url: string;

    constructor(url: string) {
        this.url = url;
    }

    connect(){
        if(this.socket){
            console.warn("Websocket ya esta conectado");
            return;
        }

        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            console.log("Conectado al WebSocket");
        };

        this.socket.onmessage = (event) => {
            const message = event.data;
            this.listeners.forEach(listener => listener(message));
        };

        this.socket.onclose = () => {
            console.log("Desconectado del WebSocket");
            this.socket = null;
        };

        this.socket.onerror = (error) => {
            console.error("Error en el WebSocket", error);
        };
    }

    // Enviar un mensaje al servidor
    sendMessage(message: string) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(message);
        } else {
            console.warn('No se puede enviar el mensaje. WebSocket no está conectado.');
        }
    }

    // Agregar un listener para recibir mensajes
    addMessageListener(listener: (message: string) => void) {
        this.listeners.push(listener);
    }

    // Eliminar un listener
    removeMessageListener(listener: (message: string) => void) {
        this.listeners = this.listeners.filter((l) => l !== listener);
    }

    // Desconectar del servidor WebSocket
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

export default WebSocketService;