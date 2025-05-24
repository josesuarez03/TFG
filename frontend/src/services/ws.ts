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

    // Obtener el token de autenticación desde sessionStorage
    const token = sessionStorage.getItem('access_token');
    
    if (!token) {
      console.warn('⚠️ No se encontró token de acceso para WebSocket');
    }

    this.socket = io(this.url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      autoConnect: true,
      forceNew: false,
      // Enviar el token de autenticación en la conexión
      auth: {
        token: token
      },
      // También se puede enviar en query si el servidor lo espera así
      query: {
        token: token
      }
    });

    // Eventos de conexión
    this.socket.on('connect', () => {
      console.log(`✅ Conectado: ${this.socket?.id}`);
      
      // Enviar token después de conectar si no se envió en la configuración inicial
      if (token) {
        this.socket?.emit('authenticate', { token });
      }
    });
    
    this.socket.on('disconnect', (reason: string) => {
      console.log(`❌ Desconectado: ${reason}`);
    });
    
    this.socket.on('connect_error', (error: unknown) => {
      console.error('❌ Error de conexión:', error);
    });
    
    this.socket.on('reconnect_error', (error: unknown) => {
      console.error('❌ Error de reconexión:', error);
    });
    
    this.socket.on('reconnect', (attempt: number) => {
      console.log(`🔄 Reconectado en intento: ${attempt}`);
      
      // Re-enviar token después de reconectar
      const currentToken = sessionStorage.getItem('access_token');
      if (currentToken) {
        this.socket?.emit('authenticate', { token: currentToken });
      }
    });

    // Eventos de autenticación
    this.socket.on('authenticated', (data: unknown) => {
      console.log('✅ Autenticado exitosamente:', data);
    });
    
    this.socket.on('authentication_error', (error: unknown) => {
      console.error('❌ Error de autenticación:', error);
    });

    // Eventos de éxito/error de conexión
    this.socket.on('connection_success', (data: unknown) => {
      console.log('✅ Conexión exitosa:', data);
    });
    
    this.socket.on('connection_error', (data: unknown) => {
      console.error('❌ Error de conexión del servidor:', data);
    });

    // Escuchar respuestas del chat - USAR EL EVENTO CORRECTO
    this.socket.on('chat_response', (data: unknown) => {
      console.log('📨 Respuesta recibida:', data);
      this.handleIncomingMessage(data);
    });

    // Eventos adicionales
    this.socket.on('error', (data: unknown) => {
      console.error('❌ Error del servidor:', data);
    });
    
    this.socket.on('typing', (data: unknown) => {
      console.log('⌨️ Bot está escribiendo:', data);
    });
  }

  private handleIncomingMessage(data: unknown): void {
    let message: string;

    if (typeof data === 'string') {
      message = data;
    } else if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      
      // PRIORIZAR ai_response que es lo que viene del servidor
      if (typeof d.ai_response === 'string') {
        message = d.ai_response;
      } else if (typeof d.content === 'string') {
        message = d.content;
      } else if (typeof d.message === 'string') {
        message = d.message;
      } else if (typeof d.text === 'string') {
        message = d.text;
      } else if (typeof d.reply === 'string') {
        message = d.reply;
      } else if (typeof d.response === 'string') {
        message = d.response;
      } else {
        // Como fallback, mostrar solo el ai_response si existe, sino el objeto completo
        if (d.ai_response) {
          message = String(d.ai_response);
        } else {
          message = JSON.stringify(data, null, 2);
          console.log('📦 Objeto completo recibido (sin ai_response):', data);
        }
      }
    } else {
      message = String(data);
    }

    // Verificar que el mensaje no esté vacío
    if (!message || !message.trim()) {
      console.warn('⚠️ Mensaje vacío recibido, ignorando');
      return;
    }

    // Notificar a todos los listeners
    this.listeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('❌ Error en listener:', error);
      }
    });
  }

  sendMessage(message: string, additionalData?: Record<string, unknown>): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Socket no conectado, no se puede enviar mensaje');
      return;
    }

    try {
      let messageData: unknown;
      
      // Intentar parsear como JSON, si falla usar string plano
      try {
        messageData = JSON.parse(message);
      } catch {
        messageData = {
          message: message,
          timestamp: new Date().toISOString(),
          ...additionalData
        };
      }

      console.log('📤 Enviando mensaje:', messageData);
      
      // USAR EL EVENTO CORRECTO QUE EL SERVIDOR ESPERA
      this.socket.emit('chat_message', messageData);
      
    } catch (error) {
      console.error('❌ Error al enviar mensaje:', error);
    }
  }

  // Método para re-autenticar si el token cambia
  reauthenticate(): void {
    const token = sessionStorage.getItem('access_token');
    if (this.socket?.connected && token) {
      console.log('🔄 Re-autenticando con nuevo token...');
      this.socket.emit('authenticate', { token });
    }
  }

  addMessageListener(listener: (message: string) => void): void {
    this.listeners.push(listener);
  }

  removeMessageListener(listener: (message: string) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getConnectionState(): string {
    if (!this.socket) return 'no_socket';
    if (this.socket.connected) return 'connected';
    if (this.socket.disconnected) return 'disconnected';
    return 'connecting';
  }

  getSocketId(): string | null {
    return this.socket?.id ?? null;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Métodos adicionales para join/leave rooms
  joinConversation(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join_conversation', { conversation_id: conversationId });
    }
  }

  leaveConversation(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave_conversation', { conversation_id: conversationId });
    }
  }


}

export default SocketIOService;