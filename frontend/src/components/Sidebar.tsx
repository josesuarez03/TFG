import React, { useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { 
  TbHome, 
  TbReportMedical, 
  TbLogout, 
  TbMessageCircle, 
  TbUserCircle, 
  TbChevronLeft, 
  TbChevronRight,
  TbStethoscope,
  TbUserPlus,
  TbClipboardList
} from "react-icons/tb";
import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";
import { ROUTES, NAVIGATION_ITEMS } from "@/routes/routePaths";
import ThemeToggle from "./theme-toggle";
import { useTheme } from "next-themes";
import { logout as apiLogout } from "@/services/api";

// Mapa de iconos para las rutas
const iconMap: Record<string, React.ReactNode> = {
  'HomeIcon': <TbHome />,
  'ChatBubbleOvalLeftIcon': <TbMessageCircle />,
  'ClipboardDocumentListIcon': <TbReportMedical />,
  'UserGroupIcon': <TbUserPlus />,
  'DocumentChartBarIcon': <TbClipboardList />,
  'StethoscopeIcon': <TbStethoscope />
};

export default function Sidebar() {
    const [isExpanded, setIsExpanded] = useState(true);
    const { user, logout, isAuthenticated } = useAuth();
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();

    const toggleSidebar = () => {
        setIsExpanded(!isExpanded);
    };

    const handleLogout = async () => {
        try {
            await apiLogout();
            logout();
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            // Intentar logout local de todas formas
            logout();
        }
    };

    const getFullName = () => {
        if (!user) return "";
        
        // Si tiene first_name y last_name, los combinamos
        if (user.first_name && user.last_name) {
            return `${user.first_name} ${user.last_name}`;
        }
        
        // Si solo tiene first_name
        if (user.first_name) {
            return user.first_name;
        }
        
        // Si solo tiene last_name
        if (user.last_name) {
            return user.last_name;
        }
        
        // Si no tiene nombres, usamos el email
        return user.email || "Usuario";
    };

    const getIcon = (iconName: string) => {
        return iconMap[iconName] || <TbHome />;
    };

    // Si no hay usuario autenticado o está cargando, no renderizamos el sidebar
    if (!isAuthenticated) {
        return null;
    }

    // Verificar si el usuario es médico
    const isDoctor = user?.tipo === 'doctor';


    return (
        <div
            className={`h-screen text-white transition-all duration-300 flex flex-col justify-between ${
                isExpanded ? "w-64" : "w-16"
            } ${theme === 'dark' ? 'bg-blue-dark' : 'bg-blue-primary'}`}
        >
            <div>
                {/* Botón para expandir/colapsar */}
                <div className="flex justify-end p-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleSidebar}
                        className="text-white"
                    >
                        {isExpanded ? <TbChevronLeft /> : <TbChevronRight />}
                    </Button>
                </div>

                {/* Avatar del usuario como enlace al perfil */}
                <Link href={ROUTES.PROTECTED.PROFILE}>
                    <div className={`flex items-center p-4 space-x-4 hover:bg-opacity-20 hover:bg-gray-700 rounded-md mx-2 ${
                        pathname === ROUTES.PROTECTED.PROFILE ? (theme === 'dark' ? "bg-blue-violet/70" : "bg-blue-medium/70") : ""
                    }`}>
                        <div className="flex items-center">
                            <TbUserCircle size={32} className="text-white" />
                            {isExpanded && (
                                <div className="ml-2">
                                    <span className="text-sm font-medium block">{getFullName()}</span>
                                    {isDoctor && <span className="text-xs text-blue-sky">Doctor</span>}
                                    {!isDoctor && <span className="text-xs text-gray-light">Paciente</span>}
                                </div>
                            )}
                        </div>
                    </div>
                </Link>

                {/* Menú principal */}
                <nav className="mt-4 space-y-2">
                    {NAVIGATION_ITEMS.main.map((item, index) => (
                        <Link
                            key={index}
                            href={item.path}
                            className={`flex items-center space-x-4 p-3 hover:bg-opacity-20 hover:bg-gray-700 rounded-md mx-2 ${
                                pathname === item.path ? (theme === 'dark' ? "bg-blue-violet/70" : "bg-blue-medium/70") : ""
                            }`}
                        >
                            <span className="text-xl">{getIcon(item.icon)}</span>
                            {isExpanded && <span className="text-sm">{item.name}</span>}
                        </Link>
                    ))}

                    {/* Elementos específicos de doctor */}
                    {isDoctor && (
                        <div className="pt-2 mt-2 border-t border-gray-700">
                            {NAVIGATION_ITEMS.doctor.map((item, index) => (
                                <Link
                                    key={`doctor-${index}`}
                                    href={item.path}
                                    className={`flex items-center space-x-4 p-3 hover:bg-opacity-20 hover:bg-gray-700 rounded-md mx-2 ${
                                        pathname === item.path ? (theme === 'dark' ? "bg-blue-violet/70" : "bg-blue-medium/70") : ""
                                    } ${isExpanded ? (theme === 'dark' ? "bg-blue-dark/60 hover:bg-blue-violet/50" : "bg-blue-primary/40 hover:bg-blue-medium/40") : ""}`}
                                >
                                    <span className="text-xl text-blue-sky">{getIcon(item.icon)}</span>
                                    {isExpanded && <span className="text-sm font-medium text-blue-sky">{item.name}</span>}
                                </Link>
                            ))}
                        </div>
                    )}
                </nav>
            </div>

            {/* Footer con botón de tema y logout */}
            <div className="mt-auto mb-4 space-y-2">
                {/* ThemeToggle con texto */}
                <div className="flex items-center p-3 hover:bg-opacity-20 hover:bg-gray-700 rounded-md mx-2">
                    {isExpanded ? (
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center">
                                <ThemeToggle />
                                <span className="text-sm ml-2">Cambiar tema</span>
                            </div>
                        </div>
                    ) : (
                        <ThemeToggle />
                    )}
                </div>
                
                {/* Botón de logout */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center space-x-4 p-3 hover:bg-opacity-20 hover:bg-gray-700 rounded-md mx-2 w-full justify-start text-gray-light"
                    onClick={handleLogout}
                >
                    <span className="text-xl"><TbLogout /></span>
                    {isExpanded && <span className="text-sm">Cerrar Sesión</span>}
                </Button>
            </div>
        </div>
    );
}