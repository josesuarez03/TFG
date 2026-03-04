import React, { Suspense, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const Chatbot = lazy(() => import('@/components/Chatbot'));

export default function ChatbotPage() {
    return (
        <Suspense
            fallback={
                <div className="h-[calc(100vh-8rem)] rounded-2xl border border-border/70 bg-card p-4 md:p-6 space-y-4">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-64 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                </div>
            }
        >
            <Chatbot />
        </Suspense>
    );
}
