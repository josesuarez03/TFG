import React from "react";
import ContentLayout from "@/components/layout/ContentLayout";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";

export const metadata = {
    title: {
        default: "Medicheck",
        template: "Medicheck | %s ",
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
            <body className="antialiased">
                <ThemeProvider>
                    <ContentLayout>{children}</ContentLayout>
                </ThemeProvider>
            </body>
        </html>
    );
}
