import React from 'react';
import { Button } from '@/components/ui/button';
import { TbSun, TbMoon, TbSettings} from 'react-icons/tb';
import { useTheme } from 'next-themes';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function ThemeToggle() {
    const { setTheme, theme } = useTheme();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    {theme === 'light' && <TbSun className="h-[1.2rem] w-[1.2rem] text-yellow-500" />}
                    {theme === 'dark' && <TbMoon className="h-[1.2rem] w-[1.2rem] text-blue-500" />}
                    {theme === 'system' && <TbSettings className="h-[1.2rem] w-[1.2rem] text-gray-500" />}
                    <span className="sr-only">Cambiar tema</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                    <TbSun className="mr-2 h-4 w-4 text-yellow-500" />
                    Claro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <TbMoon className="mr-2 h-4 w-4 text-blue-500" />
                    Oscuro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                    <TbSettings className="mr-2 h-4 w-4 text-gray-500" />
                    Sistema
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}