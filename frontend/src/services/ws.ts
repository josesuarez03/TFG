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
}

export default WebSocketService;