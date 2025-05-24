import { useEffect, useState, useCallback } from "react";
import SocketIOService from "@/services/ws";

export const useSocketIO = (url: string, isAuthenticated?: boolean) => {
    const [messages, setMessages] = useState<string[]>([]);
    const [socket, setSocket] = useState<SocketIOService | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    useEffect(() => {
        // Validar URL
        if (!url) {
            console.error("❌ URL de Socket.IO no válida");
            setConnectionError("URL no válida");
            return;
        }

        // No conectar si no está autenticado (opcional)
        if (isAuthenticated === false) {
            console.log("🔒 Usuario no autenticado, no se conectará al WebSocket");
            return;
        }

        console.log(`🔄 Inicializando conexión WebSocket a: ${url}`);
        setIsConnecting(true);
        setConnectionError(null);

        const socketService = new SocketIOService(url);
        setSocket(socketService);

        // Manejar mensajes entrantes
        const handleMessage = (message: string) => {
            console.log('📨 Mensaje recibido en hook:', message);
            setMessages((prev) => [...prev, message]);
        };

        // Configurar listeners antes de conectar
        socketService.addMessageListener(handleMessage);

        // Conectar al socket
        socketService.connect().then(() => {
            console.log('✅ Socket inicializado');
            
            // Verificar conexión periódicamente
            const connectionCheck = setInterval(() => {
                const connected = socketService.isConnected();
                setIsConnected(connected);
                setIsConnecting(!connected && socketService.getConnectionState() === 'connecting');
                
                if (connected && connectionError) {
                    setConnectionError(null);
                }
            }, 1000);

            // Limpiar el intervalo cuando el componente se desmonte
            return () => clearInterval(connectionCheck);
        }).catch((error) => {
            console.error('❌ Error al inicializar socket:', error);
            setConnectionError(error.message);
            setIsConnecting(false);
        });

        // Cleanup function
        return () => {
            console.log('🧹 Limpiando conexión WebSocket');
            socketService.removeMessageListener(handleMessage);
            socketService.disconnect();
            setSocket(null);
            setIsConnected(false);
            setIsConnecting(false);
        };
    }, [url, isAuthenticated]); // Recrear cuando cambie la URL o el estado de autenticación

    // Effect para manejar cambios en el token de autenticación
    useEffect(() => {
        if (socket && isConnected) {
            // Escuchar cambios en el sessionStorage (para cuando el token se actualice)
            const handleStorageChange = (event: StorageEvent) => {
                if (event.key === 'access_token') {
                    console.log('🔑 Token de acceso actualizado, re-autenticando WebSocket...');
                    socket.reauthenticate();
                }
            };

            window.addEventListener('storage', handleStorageChange);
            
            return () => {
                window.removeEventListener('storage', handleStorageChange);
            };
        }
    }, [socket, isConnected]);

    // Función para enviar mensajes
    const sendMessage = useCallback((message: string, additionalData?: Record<string, unknown>) => {
        if (!socket) {
            console.warn("⚠️ No se puede enviar mensaje: Socket no inicializado");
            return false;
        }

        if (!socket.isConnected()) {
            console.warn("⚠️ No se puede enviar mensaje: Socket no conectado");
            setConnectionError("Socket no conectado");
            return false;
        }

        try {
            socket.sendMessage(message, additionalData);
            console.log('✅ Mensaje enviado exitosamente');
            return true;
        } catch (error) {
            console.error('❌ Error al enviar mensaje:', error);
            setConnectionError(`Error al enviar: ${error}`);
            return false;
        }
    }, [socket]);

    // Función para limpiar mensajes
    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    // Función para reconectar manualmente
    const reconnect = useCallback(() => {
        if (socket) {
            console.log('🔄 Intentando reconectar...');
            setIsConnecting(true);
            setConnectionError(null);
            socket.disconnect();
            socket.connect();
        }
    }, [socket]);

    // Función para re-autenticar manualmente
    const reauthenticate = useCallback(() => {
        if (socket) {
            console.log('🔑 Re-autenticando WebSocket...');
            socket.reauthenticate();
        }
    }, [socket]);


    return {
        messages,
        sendMessage,
        isConnected,
        isConnecting,
        connectionError,
        clearMessages,
        reconnect,
        reauthenticate,
        socket
    };
};