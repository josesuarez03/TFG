import React, { Suspense, lazy } from 'react';

const Chatbot = lazy(() => import('@/components/Chatbot'));

export default function ChatbotPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <Suspense fallback={<div>Cargando el chatbot...</div>}>
                <Chatbot />
            </Suspense>
        </div>
    );
}