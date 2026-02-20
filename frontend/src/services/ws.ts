import { io, Socket } from "socket.io-client";

class SocketIOService {
  private socket: Socket | null = null;
  private listeners: ((message: string) => void)[] = [];
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    if (this.socket && this.socket.connected) return;

    const token = sessionStorage.getItem("access_token");

    this.socket = io(this.url, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1200,
      timeout: 20000,
      autoConnect: true,
      forceNew: false,
      auth: { token },
      query: { token },
    });

    this.socket.on("connect", () => {
      if (token) {
        this.socket?.emit("authenticate", { token });
      }
    });

    this.socket.on("reconnect", () => {
      const currentToken = sessionStorage.getItem("access_token");
      if (currentToken) {
        this.socket?.emit("authenticate", { token: currentToken });
      }
    });

    this.socket.on("chat_response", (data: unknown) => {
      this.handleIncomingMessage(data);
    });
  }

  private handleIncomingMessage(data: unknown): void {
    let message = "";

    if (typeof data === "string") {
      message = data;
    } else if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;

      if (typeof d.ai_response === "string") message = d.ai_response;
      else if (typeof d.content === "string") message = d.content;
      else if (typeof d.message === "string") message = d.message;
      else if (typeof d.text === "string") message = d.text;
      else if (typeof d.reply === "string") message = d.reply;
      else if (typeof d.response === "string") message = d.response;
      else if (d.ai_response) message = String(d.ai_response);
      else message = JSON.stringify(data);
    } else {
      message = String(data);
    }

    if (!message.trim()) return;
    this.listeners.forEach((listener) => listener(message));
  }

  sendMessage(message: string, additionalData?: Record<string, unknown>): boolean {
    if (!this.socket?.connected) return false;

    let messageData: unknown = message;
    try {
      messageData = JSON.parse(message);
    } catch {
      messageData = {
        message,
        timestamp: new Date().toISOString(),
        ...additionalData,
      };
    }

    this.socket.emit("chat_message", messageData);
    return true;
  }

  reauthenticate(): void {
    const token = sessionStorage.getItem("access_token");
    if (this.socket?.connected && token) {
      this.socket.emit("authenticate", { token });
    }
  }

  addMessageListener(listener: (message: string) => void): void {
    this.listeners.push(listener);
  }

  removeMessageListener(listener: (message: string) => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getConnectionState(): "no_socket" | "connected" | "disconnected" | "connecting" {
    if (!this.socket) return "no_socket";
    if (this.socket.connected) return "connected";
    if (this.socket.disconnected) return "disconnected";
    return "connecting";
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default SocketIOService;
