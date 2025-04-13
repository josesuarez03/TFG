import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TbSettings, TbSun, TbMoon } from 'react-icons/tb';

export default function ThemeToggle() {
    const [mounted, setMounted] = useState(false);
    const [theme, setTheme] = useState('light');

    useEffect(() => {
        setMounted(true);
        const currentTheme = localStorage.getItem('theme') || 'light';
        setTheme(currentTheme);
        document.documentElement.classList.toggle('dark', currentTheme === 'dark');
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
    };

    if (!mounted) return null;

    return (
        <Button onClick={toggleTheme} className="p-2 rounded-md bg-gray-200 dark:bg-gray-800">
             {theme === 'light' && <TbSun className="h-6 w-6 text-yellow-500" />}
            {theme === 'dark' && <TbMoon className="h-6 w-6 text-blue-500" />}
            {theme === 'system' && <TbSettings className="h-6 w-6 text-gray-500" />}
        </Button>
    );
}