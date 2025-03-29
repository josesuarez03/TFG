import { useEffect, useState } from "react";
import WebSocketService from "@/services/ws";

export const useWebSocket = (url: string) => {
    const [messages, setMessages] = useState<string[]>([]);
    const [socket, setSocket] = useState<WebSocketService | null>(null);

    useEffect(() => {
        const ws = new WebSocketService(url);
        setSocket(ws);

        ws.connect();

        const handleMessage = (message: string) => {
            setMessages((prev) => [...prev, message]);
        };

        ws.addMessageListener(handleMessage);

        return () => {
            ws.removeMessageListener(handleMessage);
            ws.disconnect();
        };
    }, [url]);

    const sendMessage = (message: string) => {
        if (socket) {
            socket.sendMessage(message);
        }
    };

    return { messages, sendMessage };
};