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
import { useRouter } from "next/router";
import { ROUTES, NAVIGATION_ITEMS } from "@/routes/routePaths";

// Mapa de iconos para las rutas
const iconMap: Record<string, React.ReactNode> = {
  'HomeIcon': <TbHome />,
  'UserIcon': <TbUserCircle />,
  'ChatBubbleOvalLeftIcon': <TbMessageCircle />,
  'ClipboardDocumentListIcon': <TbReportMedical />,
  'UserGroupIcon': <TbUserPlus />,
  'DocumentChartBarIcon': <TbClipboardList />,
  'StethoscopeIcon': <TbStethoscope />
};

export default function Sidebar() {
    const [isExpanded, setIsExpanded] = useState(true);
    const { user, logout, isAuthenticated } = useAuth();
    const router = useRouter();

    const toggleSidebar = () => {
        setIsExpanded(!isExpanded);
    };

    const handleLogout = () => {
        logout();
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
            className={`h-screen bg-gray-800 text-white transition-all duration-300 flex flex-col justify-between ${
                isExpanded ? "w-64" : "w-16"
            }`}
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

                {/* Avatar del usuario */}
                <div className="flex items-center p-4 space-x-4">
                    <div className="flex items-center">
                        <TbUserCircle size={32} className="text-white" />
                        {isExpanded && (
                            <div className="ml-2">
                                <span className="text-sm font-medium block">{getFullName()}</span>
                                {isDoctor && <span className="text-xs text-blue-300">Doctor</span>}
                                {!isDoctor && <span className="text-xs text-green-300">Paciente</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Menú principal */}
                <nav className="mt-4 space-y-2">
                    {NAVIGATION_ITEMS.main.map((item, index) => (
                        <Link
                            key={index}
                            href={item.path}
                            className={`flex items-center space-x-4 p-3 hover:bg-gray-700 rounded-md mx-2 ${
                                router.pathname === item.path ? "bg-gray-700" : ""
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
                                    className={`flex items-center space-x-4 p-3 hover:bg-gray-700 rounded-md mx-2 ${
                                        router.pathname === item.path ? "bg-gray-700" : ""
                                    } ${isExpanded ? "bg-blue-900/30 hover:bg-blue-800/40" : ""}`}
                                >
                                    <span className="text-xl text-blue-300">{getIcon(item.icon)}</span>
                                    {isExpanded && <span className="text-sm font-medium text-blue-300">{item.name}</span>}
                                </Link>
                            ))}
                        </div>
                    )}
                </nav>
            </div>

            {/* Footer con botón de perfil y logout */}
            <div className="mt-auto mb-4 space-y-2">
                <Link 
                    href={ROUTES.PROTECTED.PROFILE}
                    className={`flex items-center space-x-4 p-3 hover:bg-gray-700 rounded-md mx-2 ${
                        router.pathname === ROUTES.PROTECTED.PROFILE ? "bg-gray-700" : ""
                    }`}
                >
                    <span className="text-xl"><TbUserCircle /></span>
                    {isExpanded && <span className="text-sm">Perfil</span>}
                </Link>
                
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center space-x-4 p-3 hover:bg-gray-700 rounded-md mx-2 w-full justify-start"
                    onClick={handleLogout}
                >
                    <span className="text-xl"><TbLogout /></span>
                    {isExpanded && <span className="text-sm">Cerrar Sesión</span>}
                </Button>
            </div>
        </div>
    );
}