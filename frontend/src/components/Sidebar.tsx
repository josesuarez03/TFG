import React, { useState, useEffect } from "react";
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
  TbStethoscope
} from "react-icons/tb";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/router";

export default function Sidebar() {
    const [isExpanded, setIsExpanded] = useState(false);
    const { user, logout } = useAuth();
    const router = useRouter();
    
    // Si no hay usuario autenticado, redirecciona al login
    useEffect(() => {
        if (!user) {
            router.push("/auth/login");
        }
    }, [user, router]);

    const toggleSidebar = () => {
        setIsExpanded(!isExpanded);
    };

    const handleLogout = () => {
        logout();
        router.push("/auth/login");
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

    // Elementos de menú comunes para todos los usuarios
    const menuItems = [
        { name: "Home", icon: <TbHome />, link: "/" },
        { name: "Messages", icon: <TbMessageCircle />, link: "/messages" },
        { name: "Medical Data", icon: <TbReportMedical />, link: "/medical-data" },
    ];

    // Elemento de menú exclusivo para médicos
    const doctorMenuItem = { 
        name: "Doctor Portal", 
        icon: <TbStethoscope />, 
        link: "/doctor-portal" 
    };

    // Si no hay usuario autenticado, no renderizamos el sidebar
    if (!user) {
        return null;
    }

    // Verificar si el usuario es médico
    const isDoctor = user.tipo === 'doctor';

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
                            </div>
                        )}
                    </div>
                </div>

                {/* Menú */}
                <nav className="mt-4 space-y-2">
                    {menuItems.map((item, index) => (
                        <Link
                            key={index}
                            href={item.link}
                            className={`flex items-center space-x-4 p-3 hover:bg-gray-700 rounded-md mx-2 ${
                                router.pathname === item.link ? "bg-gray-700" : ""
                            }`}
                        >
                            <span className="text-xl">{item.icon}</span>
                            {isExpanded && <span className="text-sm">{item.name}</span>}
                        </Link>
                    ))}

                    {/* Opción exclusiva para médicos */}
                    {isDoctor && (
                        <Link
                            href={doctorMenuItem.link}
                            className={`flex items-center space-x-4 p-3 hover:bg-gray-700 rounded-md mx-2 ${
                                router.pathname === doctorMenuItem.link ? "bg-gray-700" : ""
                            } ${isExpanded ? "bg-blue-900/40 hover:bg-blue-800/50" : ""}`}
                        >
                            <span className="text-xl text-blue-300">{doctorMenuItem.icon}</span>
                            {isExpanded && <span className="text-sm font-medium text-blue-300">{doctorMenuItem.name}</span>}
                        </Link>
                    )}
                </nav>
            </div>

            {/* Footer con botón de perfil y logout */}
            <div className="mt-auto mb-4 space-y-2">
                <Link 
                    href="/profile"
                    className={`flex items-center space-x-4 p-3 hover:bg-gray-700 rounded-md mx-2 ${
                        router.pathname.startsWith("/profile") ? "bg-gray-700" : ""
                    }`}
                >
                    <span className="text-xl"><TbUserCircle /></span>
                    {isExpanded && <span className="text-sm">Profile</span>}
                </Link>
                
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center space-x-4 p-3 hover:bg-gray-700 rounded-md mx-2 w-full justify-start"
                    onClick={handleLogout}
                >
                    <span className="text-xl"><TbLogout /></span>
                    {isExpanded && <span className="text-sm">Logout</span>}
                </Button>
            </div>
        </div>
    );
}