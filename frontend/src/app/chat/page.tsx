import React, { Suspense, lazy } from 'react';

const Chatbot = lazy(() => import('@/components/Chatbot'));

export default function ChatbotPage() {
    return (
        <Suspense fallback={<div>Cargando el chatbot...</div>}>
            <Chatbot />
        </Suspense>
    );
}