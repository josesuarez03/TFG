import React from "react";
import ContentLayout from "@/components/layout/ContentLayout";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";

export const metadata = {
    title: {
        default: "Medicheck",
        template: "Medicheck | %s",
    },
    description: "Asistente médico y gestión de datos de salud",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/favicon.ico"></link>
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" content="#2583CC" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <link rel="apple-touch-icon" href="/assets/img/icon192.png" />
            </head>
            <body className="antialiased">
                <ThemeProvider>
                    <ContentLayout>{children}</ContentLayout>
                </ThemeProvider>
            </body>
        </html>
    );
}
