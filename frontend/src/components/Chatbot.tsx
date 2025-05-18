'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSocketIO } from '@/hooks/useWs';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { TbSend } from 'react-icons/tb';
import type { Message } from '@/types/messages';

export default function Chatbot() {
    const { user, isAuthenticated } = useAuth();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    // Usar Socket.IO URL
    const socketUrl = process.env.NEXT_PUBLIC_SOCKETIO_URL || 'http://localhost:5000';
    const { 
        messages: socketMessages, 
        sendMessage, 
        isConnected, 
        isConnecting,
        connectionError,
        reauthenticate,
    } = useSocketIO(socketUrl, isAuthenticated);
    
    // Re-autenticar cuando el usuario haga login y socket esté conectado
    useEffect(() => {
        if (isAuthenticated && isConnected) {
            reauthenticate();
        }
    }, [isAuthenticated, isConnected, reauthenticate]);
    
    // Mensaje inicial de Hipo
    useEffect(() => {
        setMessages([
            {
                id: '0',
                content: 'Hola, soy Hipo tu asistente médico. ¿Cómo te sientes hoy?',
                sender: 'bot',
                timestamp: new Date(),
            }
        ]);
    }, []);
    
    // Procesar mensajes entrantes del Socket.IO
    useEffect(() => {
        if (socketMessages.length > 0) {
            const lastMessage = socketMessages[socketMessages.length - 1];
            console.log('📨 Procesando mensaje:', lastMessage);
            
            try {
                let messageContent: string;
                
                // Intentar parsear como JSON si es necesario
                try {
                    const parsedMessage = JSON.parse(lastMessage);
                    messageContent = parsedMessage.content || 
                                   parsedMessage.message || 
                                   parsedMessage.response || 
                                   parsedMessage.text || 
                                   lastMessage;
                } catch {
                    // Si no es JSON válido, usar el mensaje tal como está
                    messageContent = lastMessage;
                }
                
                // Verificar que el contenido no esté vacío
                if (messageContent && messageContent.trim()) {
                    const newMessage: Message = {
                        id: Date.now().toString(),
                        content: typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent),
                        sender: 'bot',
                        timestamp: new Date(),
                    };
                    
                    setMessages(prev => {
                        // Evitar duplicados checking del último mensaje
                        const lastMsg = prev[prev.length - 1];
                        if (lastMsg && lastMsg.content === newMessage.content && lastMsg.sender === 'bot') {
                            return prev;
                        }
                        return [...prev, newMessage];
                    });
                    
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('❌ Error procesando mensaje de Socket.IO:', error);
                setIsLoading(false);
            }
        }
    }, [socketMessages]);
    
    // Auto-scroll al último mensaje
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!input.trim() || !isConnected) {
            console.warn('⚠️ No se puede enviar: entrada vacía o no conectado');
            return;
        }
        
        // Agregar el mensaje del usuario al chat
        const userMessage: Message = {
            id: Date.now().toString(),
            content: input,
            sender: 'user',
            timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        
        // Preparar payload para el servidor
        const messagePayload = {
            message: input,
            user_id: user?.id || 'guest',
            timestamp: new Date().toISOString(),
            context: {} // Datos adicionales si es necesario
        };
        
        console.log('📤 Enviando mensaje:', messagePayload);
        
        // Enviar mensaje al servidor via Socket.IO
        const success = sendMessage(JSON.stringify(messagePayload));
        
        if (!success) {
            console.error('❌ Fallo al enviar mensaje');
            setIsLoading(false);
            // Opcionalmente remover el mensaje del usuario si falla el envío
            setMessages(prev => prev.slice(0, -1));
        }
        
        setInput('');
    };
    
    // Función para obtener el estado de conexión
    const getConnectionStatus = () => {
        if (isConnecting) return 'Conectando...';
        if (isConnected) return 'Conectado';
        if (connectionError) return `Error: ${connectionError}`;
        return 'Desconectado';
    };
    
    return (
        <Card className="w-full h-[85vh] max-w-md mx-auto flex flex-col">
            <CardHeader className="py-3 px-4 border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold">
                        Hipo ({getConnectionStatus()})
                    </CardTitle>
                </div>
                
                {/* Indicador visual de estado */}
                <div className="flex items-center gap-2 mt-2">
                    <div 
                        className={`w-2 h-2 rounded-full ${
                            isConnected ? 'bg-green-500' : 
                            isConnecting ? 'bg-yellow-500' : 
                            'bg-red-500'
                        }`}
                    />
                    <span className="text-sm text-gray-500">
                        {getConnectionStatus()}
                    </span>
                </div>
                
                {/* Mostrar error si existe */}
                {connectionError && (
                    <div className="text-sm text-red-500 mt-1">
                        {connectionError}
                    </div>
                )}
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div 
                        key={message.id}
                        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div 
                            className={`max-w-[80%] rounded-lg p-3 ${
                                message.sender === 'user' 
                                    ? 'bg-primary text-primary-foreground' 
                                    : 'bg-muted'
                            }`}
                        >
                            <div className="whitespace-pre-wrap">
                                {message.content}
                            </div>
                            <div className="text-xs opacity-70 mt-1">
                                {message.timestamp.toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                            <div className="flex space-x-2">
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </CardContent>
            
            <CardFooter className="p-2 border-t">
                <form onSubmit={handleSendMessage} className="flex w-full space-x-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={
                            isConnected ? "Escribe tu mensaje aquí..." : 
                            isConnecting ? "Conectando..." : 
                            "No conectado"
                        }
                        className="flex-1"
                        disabled={isLoading || !isConnected}
                    />
                    <Button 
                        type="submit" 
                        size="icon"
                        disabled={isLoading || !input.trim() || !isConnected}
                        title={!isConnected ? "No conectado al servidor" : "Enviar mensaje"}
                    >
                        <TbSend className="h-5 w-5" />
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
}
