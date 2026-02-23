import React from 'react';
import { Button } from '@/components/ui/button';
import { TbSun, TbMoon, TbSettings } from 'react-icons/tb';
import { useTheme } from 'next-themes';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function ThemeToggle() {
    const { setTheme, resolvedTheme, theme } = useTheme();
    const activeTheme = theme === 'system' ? 'system' : resolvedTheme || theme || 'system';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Cambiar tema">
                    {activeTheme === 'light' && <TbSun className="h-[1.2rem] w-[1.2rem] text-amber-500" />}
                    {activeTheme === 'dark' && <TbMoon className="h-[1.2rem] w-[1.2rem] text-sky-300" />}
                    {activeTheme === 'system' && <TbSettings className="h-[1.2rem] w-[1.2rem] text-slate-500" />}
                    <span className="sr-only">Cambiar tema</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                    <TbSun className="mr-2 h-4 w-4 text-amber-500" />
                    Claro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <TbMoon className="mr-2 h-4 w-4 text-sky-300" />
                    Oscuro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                    <TbSettings className="mr-2 h-4 w-4 text-slate-500" />
                    Sistema
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
