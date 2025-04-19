'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWs';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { TbSend } from 'react-icons/tb';
import type { Message } from '@/types/messages';

export default function Chatbot() {
    const { user } = useAuth();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || '';
    const { messages: wsMessages, sendMessage } = useWebSocket(wsUrl);
    
    // Mensaje inicial de Hipo
    useEffect(() => {
        setMessages([
            {
                id: '0',
                content: 'Hola, soy Hipo tu asistente medico. ¿Como te sientes hoy?',
                sender: 'bot',
                timestamp: new Date(),
            }
        ]);
    }, []);
    
    // Procesar mensajes entrantes del websocket
    useEffect(() => {
        if (wsMessages.length > 0) {
            try {
                const lastMessage = wsMessages[wsMessages.length - 1];
                const parsedMessage = JSON.parse(lastMessage);
                
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    content: parsedMessage.content,
                    sender: 'bot',
                    timestamp: new Date(),
                }]);
                
                setIsLoading(false);
            } catch (error) {
                console.error('Error parsing websocket message:', error);
            }
        }
    }, [wsMessages]);
    
    // Auto-scroll al último mensaje
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!input.trim()) return;
        
        // Agregar el mensaje del usuario al chat
        const userMessage: Message = {
            id: Date.now().toString(),
            content: input,
            sender: 'user',
            timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        
        // Enviar mensaje al servidor via websocket
        const messagePayload = JSON.stringify({
            userId: user?.id || 'guest',
            message: input,
            timestamp: new Date().toISOString()
        });
        
        sendMessage(messagePayload);
        setInput('');
    };
    
    return (
        <Card className="w-full h-[85vh] max-w-md mx-auto flex flex-col">
            <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-xl font-bold text-center">Hipo</CardTitle>
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
                            {message.content}
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
                        placeholder="Escribe tu mensaje aquí..."
                        className="flex-1"
                        disabled={isLoading}
                    />
                    <Button 
                        type="submit" 
                        size="icon"
                        disabled={isLoading || !input.trim()}
                    >
                        <TbSend className="h-5 w-5" />
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
}