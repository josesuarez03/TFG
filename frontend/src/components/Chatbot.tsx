'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSocketIO } from '@/hooks/useWs';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  TbAlertTriangle,
  TbCircleDot,
  TbClipboardText,
  TbDotsVertical,
  TbFileDescription,
  TbMicrophone,
  TbPaperclip,
  TbPlugConnected,
  TbRefresh,
  TbSearch,
  TbSend,
} from 'react-icons/tb';
import type { Message } from '@/types/messages';

const RESPONSE_TIMEOUT_MS = 25000;
const QUICK_REPLIES = [
  'No he tomado medicación',
  'También tengo dolor de garganta',
  '¿Debo ir a urgencias ahora?',
  'Tengo alergia a la penicilina',
];

const SESSION_ITEMS = [
  { title: 'Dolor de cabeza y fiebre', preview: 'Hola, soy Hipo tu asistente...', level: 'Urgente · Niv. 3', time: 'Hoy' },
  { title: 'Tos y congestión nasal', preview: 'Tengo tos seca desde hace 3 días...', level: 'Leve · Niv. 4', time: 'Hace 5d' },
  { title: 'Dolor muscular', preview: 'Me duelen los gemelos tras correr...', level: 'Leve · Niv. 4', time: 'Hace 12d' },
];

const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const formatTime = (isoDate: string) =>
  new Date(isoDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

export default function Chatbot() {
  const { user, isAuthenticated } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isWaitingBot, setIsWaitingBot] = useState(false);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [inputRows, setInputRows] = useState(1);
  const responseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenResponsesRef = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const socketUrl = process.env.NEXT_PUBLIC_SOCKETIO_URL || 'http://localhost:5000';
  const { messages: socketMessages, sendMessage, isConnected, isConnecting, connectionError, reauthenticate, reconnect } =
    useSocketIO(socketUrl, isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && isConnected) {
      reauthenticate();
    }
  }, [isAuthenticated, isConnected, reauthenticate]);

  useEffect(() => {
    setMessages([
      {
        id: createMessageId(),
        content: 'Hola, soy Hipo. Estoy aquí para ayudarte con tu triaje médico. ¿Cómo te sientes hoy?',
        sender: 'bot',
        status: 'sent',
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  useEffect(() => {
    if (socketMessages.length === 0) return;
    const lastMessage = socketMessages[socketMessages.length - 1];
    if (!lastMessage?.trim()) return;
    if (seenResponsesRef.current.has(lastMessage)) return;
    seenResponsesRef.current.add(lastMessage);

    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: createMessageId(),
        content: lastMessage,
        sender: 'bot',
        status: 'sent',
        timestamp: new Date().toISOString(),
      },
    ]);

    if (pendingMessageId) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === pendingMessageId && message.status === 'pending'
            ? { ...message, status: 'sent' }
            : message
        )
      );
      setPendingMessageId(null);
    }

    setIsWaitingBot(false);
    setChatError(null);
  }, [socketMessages, pendingMessageId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWaitingBot]);

  useEffect(() => {
    return () => {
      if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
    };
  }, []);

  const connectionLabel = useMemo(() => {
    if (isConnected) return 'Conectado';
    if (isConnecting) return 'Conectando';
    if (connectionError) return 'Sin conexión';
    return 'Desconectado';
  }, [isConnected, isConnecting, connectionError]);

  const submitMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || !isConnected) return;

    const userMessageId = createMessageId();
    const userMessage: Message = {
      id: userMessageId,
      content: trimmed,
      sender: 'user',
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setPendingMessageId(userMessageId);
    setIsWaitingBot(true);
    setChatError(null);

    const messagePayload = {
      message: trimmed,
      user_id: user?.id || 'guest',
      timestamp: new Date().toISOString(),
      context: {},
    };

    const success = sendMessage(JSON.stringify(messagePayload));
    if (!success) {
      setMessages((prev) =>
        prev.map((message) => (message.id === userMessageId ? { ...message, status: 'error' } : message))
      );
      setPendingMessageId(null);
      setIsWaitingBot(false);
      setChatError('No se pudo enviar el mensaje. Revisa la conexión e intenta otra vez.');
      return;
    }

    responseTimeoutRef.current = setTimeout(() => {
      setMessages((prev) =>
        prev.map((message) => (message.id === userMessageId ? { ...message, status: 'error' } : message))
      );
      setPendingMessageId(null);
      setIsWaitingBot(false);
      setChatError('No se recibió respuesta del asistente. Intenta enviar nuevamente.');
    }, RESPONSE_TIMEOUT_MS);

    setInput('');
    setInputRows(1);
  };

  const handleSendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    submitMessage();
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    const lines = value.split('\n').length;
    setInputRows(Math.min(5, Math.max(1, lines)));
  };

  const applySuggestion = (suggestion: string) => {
    setInput(suggestion);
    setInputRows(Math.min(5, Math.max(1, suggestion.split('\n').length)));
  };

  return (
    <div className="h-[calc(100vh-8rem)] rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-[320px_1fr]">
      <aside className="border-r border-border/70 bg-card/80 flex flex-col min-h-0">
        <div className="p-4 border-b border-border/70">
          <h3 className="text-2xl font-semibold tracking-tight">Sesiones</h3>
          <div className="mt-3 relative">
            <TbSearch className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Buscar sesión..."
            />
          </div>
        </div>
        <div className="p-3 space-y-2 overflow-y-auto min-h-0">
          {SESSION_ITEMS.map((session, index) => (
            <button
              key={session.title}
              className={`w-full rounded-xl border p-3 text-left transition ${
                index === 0 ? 'border-blue-200 bg-blue-50/60' : 'border-border/60 bg-background hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold truncate">{session.title}</p>
                <span className="text-xs text-muted-foreground shrink-0">{session.time}</span>
              </div>
              <p className="text-sm text-muted-foreground truncate mt-1">{session.preview}</p>
              <p className="text-xs mt-2 font-medium text-emerald-700">{session.level}</p>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-border/70">
          <Button className="w-full">
            + Nueva sesión
          </Button>
        </div>
      </aside>

      <section className="min-h-0 flex flex-col">
        <div className="h-16 border-b border-border/70 px-4 md:px-5 flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">🤖</div>
            <div>
              <p className="font-semibold text-xl leading-none">Hipo</p>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <TbPlugConnected className="h-4 w-4 text-emerald-500" />
                {connectionLabel} · Asistente de triaje
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold rounded-full px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200">
              Niv. 3 · Urgente
            </span>
            <Button variant="outline" size="icon" aria-label="Resumen">
              <TbFileDescription className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={reconnect} disabled={isConnecting} aria-label="Más opciones">
              <TbRefresh className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label="Opciones">
              <TbDotsVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-muted/30" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] md:max-w-[78%] rounded-2xl px-4 py-3 ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white shadow'
                    : message.sender === 'system'
                      ? 'bg-red-50 border border-red-200 text-red-700'
                      : 'bg-white border border-border/60'
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-[15px] leading-7">{message.content}</p>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className={`text-xs ${message.sender === 'user' ? 'text-blue-100' : 'text-muted-foreground'}`}>
                    {formatTime(message.timestamp)}
                  </span>
                  {message.status === 'pending' && <span className="text-xs opacity-80">Enviando...</span>}
                  {message.status === 'error' && (
                    <span className="text-xs text-red-600 flex items-center gap-1">
                      <TbAlertTriangle className="h-3.5 w-3.5" />
                      Error
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isWaitingBot && (
            <div className="flex justify-start">
              <div className="max-w-[90%] md:max-w-[78%] rounded-2xl px-4 py-3 bg-white border border-border/60">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            </div>
          )}

          {chatError && (
            <div className="flex justify-start">
              <div className="max-w-[90%] md:max-w-[78%] rounded-2xl px-4 py-3 bg-red-50 border border-red-200 text-red-700">
                <p className="text-sm">{chatError}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border/70 bg-card px-4 py-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_REPLIES.map((item) => (
              <button
                key={item}
                type="button"
                className="rounded-full border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted transition"
                onClick={() => applySuggestion(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="w-full flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={inputRows}
              placeholder={
                isConnected
                  ? 'Escribe tu mensaje aquí...'
                  : isConnecting
                    ? 'Conectando...'
                    : 'Sin conexión con el servidor'
              }
              className="min-h-[44px] max-h-36 resize-none"
              disabled={!isConnected || isWaitingBot}
              aria-label="Mensaje para el asistente"
            />
            <div className="flex items-center gap-1">
              <Button type="button" size="icon" variant="ghost" aria-label="Adjuntar archivo">
                <TbPaperclip className="h-5 w-5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" aria-label="Dictado de voz">
                <TbMicrophone className="h-5 w-5" />
              </Button>
              <Button
                type="submit"
                size="icon"
                disabled={!isConnected || !input.trim() || isWaitingBot}
                title={!isConnected ? 'No conectado al servidor' : 'Enviar mensaje'}
                aria-label="Enviar mensaje"
              >
                <TbSend className="h-5 w-5" />
              </Button>
            </div>
          </form>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <TbCircleDot className="h-4 w-4 text-blue-500" />
            Hipo orienta y prioriza. El diagnóstico definitivo siempre lo da un profesional sanitario.
            <TbClipboardText className="h-4 w-4 ml-1" />
          </div>
        </div>
      </section>
    </div>
  );
}
