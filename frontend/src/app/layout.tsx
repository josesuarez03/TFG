import React from 'react';
import { ThemeProvider } from 'next-themes';
import ContentLayout from '@/components/layout/ContentLayout';


export const metadata = {
    title: {
      default: 'Medicheck',
      template: 'Medicheck | %s ',
    },
    description: 'Asistente médico y gestión de datos de salud',
  };
  
export default function RootLayout({ children }: { children: React.ReactNode }) {

    return (
        <html lang="es" className="bg-white dark:bg-gray-900">
            <body className="antialiased">
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
                    <ContentLayout>{children}</ContentLayout>
                </ThemeProvider>
            </body>
        </html>
    );
}