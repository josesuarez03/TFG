import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TbEdit, TbUser, TbPhone, TbCalendar, TbMapPin, TbBriefcase } from "react-icons/tb";

export default function UserProfile() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    useEffect(() => {
        // Redirigir si no hay usuario autenticado
        if (!authLoading && !user) {
            router.push('/auth/login');
        }
    }, [user, authLoading, router]);

    if (authLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24"></svg>
                <span className="text-white">Cargando...</span>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center p-10">
                <Alert>
                    <AlertDescription>
                        Debes iniciar sesión para ver tu perfil.
                        <Button
                            onClick={() => router.push('/auth/login')}
                            className="ml-4"
                        >
                            Iniciar Sesión
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const handleEditProfile = () => {
        router.push('/profile/edit');
    };

    // Función para formatear la fecha
    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'No especificado';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <Card className="w-full max-w-3xl mx-auto shadow-lg">
                <CardHeader className="flex flex-col sm:flex-row items-center justify-between pb-6 border-b">
                    <div className="flex flex-col sm:flex-row items-center">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-800 text-2xl mr-4">
                            <TbUser />
                        </div>
                        <div className="text-center sm:text-left">
                            <CardTitle className="text-2xl font-bold">
                                {user.first_name} {user.last_name}
                            </CardTitle>
                            <p className="text-gray-600">{user.email}</p>
                            <div className="mt-1 inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm">
                                {user.tipo === 'patient' ? 'Paciente' : 'Doctor'}
                            </div>
                        </div>
                    </div>
                    <Button 
                        onClick={handleEditProfile} 
                        className="mt-4 sm:mt-0 flex items-center"
                    >
                        <TbEdit className="mr-2" />
                        Editar Perfil
                    </Button>
                </CardHeader>
                
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Información Personal</h3>
                            
                            <div className="space-y-4">
                                <div className="flex items-start">
                                    <TbCalendar className="w-5 h-5 mr-3 mt-1 text-gray-500" />
                                    <div>
                                        <p className="text-sm text-gray-500">Fecha de Nacimiento</p>
                                        <p>{formatDate(user.fecha_nacimiento)}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-start">
                                    <TbUser className="w-5 h-5 mr-3 mt-1 text-gray-500" />
                                    <div>
                                        <p className="text-sm text-gray-500">Género</p>
                                        <p>{user.genero ? user.genero.charAt(0).toUpperCase() + user.genero.slice(1) : 'No especificado'}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-start">
                                    <TbPhone className="w-5 h-5 mr-3 mt-1 text-gray-500" />
                                    <div>
                                        <p className="text-sm text-gray-500">Teléfono</p>
                                        <p>{user.telefono || 'No especificado'}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-start">
                                    <TbMapPin className="w-5 h-5 mr-3 mt-1 text-gray-500" />
                                    <div>
                                        <p className="text-sm text-gray-500">Dirección</p>
                                        <p>{user.direccion || 'No especificada'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Información específica según el tipo de usuario */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 border-b pb-2">
                                {user.tipo === 'patient' ? 'Información Médica' : 'Información Profesional'}
                            </h3>
                            
                            {user.tipo === 'patient' && user.patient && (
                                <div className="space-y-4">
                                    <div className="flex items-start">
                                        <TbBriefcase className="w-5 h-5 mr-3 mt-1 text-gray-500" />
                                        <div>
                                            <p className="text-sm text-gray-500">Ocupación</p>
                                            <p>{user.patient.ocupacion || 'No especificada'}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start">
                                        <svg className="w-5 h-5 mr-3 mt-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                        </svg>
                                        <div>
                                            <p className="text-sm text-gray-500">Alergias</p>
                                            <p>{user.patient.allergies || 'Ninguna alergia registrada'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {user.tipo === 'doctor' && user.doctor && (
                                <div className="space-y-4">
                                    <div className="flex items-start">
                                        <svg className="w-5 h-5 mr-3 mt-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
                                        </svg>
                                        <div>
                                            <p className="text-sm text-gray-500">Especialidad</p>
                                            <p>{user.doctor.especialidad || 'No especificada'}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start">
                                        <svg className="w-5 h-5 mr-3 mt-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path>
                                        </svg>
                                        <div>
                                            <p className="text-sm text-gray-500">Número de Licencia</p>
                                            <p>{user.doctor.numero_licencia || 'No especificado'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
                
                <CardFooter className="flex flex-col sm:flex-row justify-between items-center border-t pt-6 mt-6">
                    <p className="text-sm text-gray-500 mb-4 sm:mb-0">
                        Miembro desde {formatDate(user.date_joined)}
                    </p>
                    <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
                        <Button 
                            onClick={() => router.push('/profile/change-password')} 
                            className="w-full sm:w-auto"
                        >
                            Cambiar Contraseña
                        </Button>
                        <Button 
                            onClick={() => router.push('/profile/delete-account')} 
                            variant="destructive" 
                            className="w-full sm:w-auto"
                        >
                            Eliminar Cuenta
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}