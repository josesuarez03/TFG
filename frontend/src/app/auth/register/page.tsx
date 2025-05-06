"use client"

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { register as apiRegister } from '@/services/api';
import axios from 'axios';
import { TbBrandGoogle, TbLock, TbMail, TbUser, TbUsers, TbLoader, TbAlertTriangle, TbLogin, TbUserCircle, TbCheckbox, TbAt } from "react-icons/tb";
import { ROUTES } from '@/routes/routePaths';

// Esquema de validación con Zod
const registerSchema = z.object({
    email: z.string()
        .min(1, { message: 'El email es obligatorio' })
        .email({ message: 'Email inválido' }),
    username: z.string()
        .min(3, { message: 'El nombre de usuario debe tener al menos 3 caracteres' })
        .max(30, { message: 'El nombre de usuario no puede exceder los 30 caracteres' })
        .regex(/^[a-zA-Z0-9_]+$/, { message: 'El nombre de usuario solo puede contener letras, números y guiones bajos' }),
    password: z.string()
        .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
        .regex(/[A-Z]/, { message: 'Debe contener al menos una letra mayúscula' })
        .regex(/[a-z]/, { message: 'Debe contener al menos una letra minúscula' })
        .regex(/[0-9]/, { message: 'Debe contener al menos un número' })
        .regex(/[@$!%*?&]/, { message: 'Debe contener al menos un carácter especial (@$!%*?&)' }),
    confirmPassword: z.string()
        .min(1, { message: 'La confirmación de contraseña es obligatoria' }),
    first_name: z.string()
        .min(1, { message: 'El nombre es obligatorio' })
        .regex(/^[a-zA-Z\s]+$/, { message: 'El nombre solo puede contener letras y espacios' })
        .max(50, { message: 'El nombre no puede exceder los 50 caracteres' }),
    last_name: z.string()
        .min(1, { message: 'El apellido es obligatorio' })
        .regex(/^[a-zA-Z\s]+$/, { message: 'El apellido solo puede contener letras y espacios' })
        .max(50, { message: 'El apellido no puede exceder los 50 caracteres' }),
    tipo: z.string().min(1, { message: 'El tipo de usuario es obligatorio' }),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
});

type RegisterFormInputs = z.infer<typeof registerSchema>;

export default function Register() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const type = searchParams.get('type');
    
    const { login, loginWithGoogle, error: authError, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [googleError, setGoogleError] = useState<string | null>(null);
    const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    
    const { register, handleSubmit, formState: { errors }, setValue } = useForm<RegisterFormInputs>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            tipo: type || 'patient'
        }
    });

    // Verificar si hay un tipo en la URL y redirigir si no existe
    useEffect(() => {
        if (!type) {
            router.push(ROUTES.PUBLIC.PROFILE_TYPE);
        } else {
            localStorage.setItem('selectedProfileType', type);
            setValue('tipo', type);
        }
    }, [type, router, setValue]);


    const onSubmit = async (data: RegisterFormInputs) => {
        setServerStatus('checking');
        
        setLoading(true);
        setError(null);
        
        const registerData = {
            email: data.email,
            username: data.username,
            password: data.password,
            password2: data.confirmPassword,
            first_name: data.first_name,
            last_name: data.last_name,
            tipo: data.tipo,
        };
        
        
        try {
            // Usar la función de registro importada
            setServerStatus('online');
            const response = await apiRegister(registerData);
            console.log('Registro exitoso:', response);
            
            // Intentar login automático después del registro
            try {
                await login(data.email, data.password);
                console.log('Login automático exitoso');
                // No es necesario redireccionar aquí ya que useAuth ya lo hace
            } catch (loginErr) {
                console.error('Error en login automático:', loginErr);
                setError("Registro exitoso, pero hubo un problema al iniciar sesión automáticamente. Por favor, inicia sesión manualmente.");
                router.push(ROUTES.PUBLIC.LOGIN);
            }
        } catch (err) {
            console.error('Error en el registro:', err);
            
            if (axios.isAxiosError(err)) {
                // Si es un error de red
                if (!err.response) {
                    setError('No se puede conectar al servidor. Por favor, verifica tu conexión a internet.');
                    setServerStatus('offline');
                } else {
                    const errorData = err.response?.data;
                    console.error('Detalles del error:', errorData);
                    
                    // Extraer mensaje de error de forma más robusta
                    let errorMessage = 'Error en el registro. Por favor revisa tus datos.';
                    
                    if (typeof errorData === 'object' && errorData !== null) {
                        // Buscar mensajes de error en varios lugares posibles
                        if (errorData.detail) {
                            errorMessage = errorData.detail;
                        } else if (errorData.email && Array.isArray(errorData.email)) {
                            errorMessage = `Email: ${errorData.email[0]}`;
                        } else if (errorData.username && Array.isArray(errorData.username)) {
                            errorMessage = `Usuario: ${errorData.username[0]}`;
                        } else if (errorData.non_field_errors && Array.isArray(errorData.non_field_errors)) {
                            errorMessage = errorData.non_field_errors[0];
                        }
                    }
                    
                    setError(errorMessage);
                }
            } else {
                setError("Error desconocido. Por favor, inténtalo nuevamente.");
            }
        } finally {
            setLoading(false);
        }
    };

    // Componente para el botón de Google mejorado
    const GoogleSignInButton = () => {
        const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
            if (!credentialResponse.credential) {
                setGoogleError("No se pudo obtener credenciales de Google");
                return;
            }

            try {
                setGoogleError(null);
                // Usar el tipo actual para el registro
                await loginWithGoogle(credentialResponse.credential, type || 'patient');
            } catch (err) {
                console.error("Error con Google login:", err);
                setGoogleError("Error al iniciar sesión con Google. Por favor intenta nuevamente.");
            }
        };

        return (
            <div className="mb-4">
                <GoogleOAuthProvider 
                    clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}
                >
                    <div className="flex justify-center w-full">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => setGoogleError("Error al iniciar sesión con Google")}
                            useOneTap={false}
                            theme="outline" 
                            text="signup_with"
                            shape="rectangular"
                            size="large"
                            locale="es"
                            context="signup"
                            width={320}
                        />
                    </div>
                </GoogleOAuthProvider>
            </div>
        );
    };

    // Determinar texto según tipo de usuario
    const getUserTypeText = () => {
        return type === 'doctor' ? 'Médico' : 'Paciente';
    };

    return (
        <Card className='w-full max-w-md mx-auto mt-10 p-6 shadow-lg'>
          <CardHeader>
            <CardTitle className="text-center">
                <Image
                    src="/assets/img/logo.png"
                    alt="Logo"
                    width={100}
                    height={100}
                    className="mx-auto mb-4"
                />
                <div className="flex items-center justify-center">
                    {type === 'doctor' ? (
                        <TbUserCircle className="w-6 h-6 mr-2 text-blue-500" />
                    ) : (
                        <TbUsers className="w-6 h-6 mr-2 text-blue-500" />
                    )}
                    <span>Registro como {getUserTypeText()}</span>
                </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mostrar alertas de error si existen */}
            {(authError || error || googleError) && (
                <Alert variant="destructive" className="mb-4">
                    <AlertDescription className="flex items-center">
                        <TbAlertTriangle className="w-5 h-5 mr-2" />
                        <span>{authError || error || googleError}</span>
                    </AlertDescription>
                </Alert>
            )}
            
            {/* Estado del servidor */}
            {serverStatus === 'checking' && (
                <Alert className="mb-4">
                    <AlertDescription className="flex items-center">
                        <TbLoader className="animate-spin w-5 h-5 mr-2" />
                        <span>Comprobando conexión con el servidor...</span>
                    </AlertDescription>
                </Alert>
            )}
            
            {/* Componente mejorado de Google Sign-In */}
            <GoogleSignInButton />
            
            <Separator className="my-4" />

            <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
                <div>
                    <Label className="flex items-center">
                        <TbMail className="w-5 h-5 mr-2 text-gray-500" />
                        Email
                    </Label>
                    <Input type="email" {...register('email')} />
                    {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
                </div>
                <div>
                    <Label className="flex items-center">
                        <TbAt className="w-5 h-5 mr-2 text-gray-500" />
                        Nombre de usuario
                    </Label>
                    <Input type="text" {...register('username')} />
                    {errors.username && <p className="text-red-500 text-sm">{errors.username.message}</p>}
                </div>
                <div>
                    <Label className="flex items-center">
                        <TbUser className="w-5 h-5 mr-2 text-gray-500" />
                        Nombre
                    </Label>
                    <Input type="text" {...register('first_name')} />
                    {errors.first_name && <p className="text-red-500 text-sm">{errors.first_name.message}</p>}
                </div>
                <div>
                    <Label className="flex items-center">
                        <TbUsers className="w-5 h-5 mr-2 text-gray-500" />
                        Apellido
                    </Label>
                    <Input type="text" {...register('last_name')} />
                    {errors.last_name && <p className="text-red-500 text-sm">{errors.last_name.message}</p>}
                </div>
                <div>
                    <Label className="flex items-center">
                        <TbLock className="w-5 h-5 mr-2 text-gray-500" />
                        Contraseña
                    </Label>
                    <Input type="password" {...register('password')} />
                    {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
                </div>
                <div>
                    <Label className="flex items-center">
                        <TbCheckbox className="w-5 h-5 mr-2 text-gray-500" />
                        Confirmar Contraseña
                    </Label>
                    <Input type="password" {...register('confirmPassword')} />
                    {errors.confirmPassword && <p className="text-red-500 text-sm">{errors.confirmPassword.message}</p>}
                </div>
                
                {/* Campo oculto para el tipo de usuario */}
                <input type="hidden" {...register('tipo')} />
                
                <Button 
                    type="submit" 
                    //disabled={loading || authLoading || serverStatus !== 'online'} 
                    className="w-full flex items-center justify-center"
                >
                    {(loading || authLoading) ? (
                        <>
                            <TbLoader className="animate-spin h-5 w-5 mr-3" />
                            <span>Cargando...</span>
                        </>
                    ) : (
                        <>
                            <span>Registrarse</span>
                        </>
                    )}
                </Button>
            </form>
          </CardContent>
          <CardFooter className="text-center">
                <p className="flex items-center justify-center w-full">
                    ¿Ya tienes cuenta? 
                    <Link href={ROUTES.PUBLIC.LOGIN} className="text-blue-500 hover:underline ml-2 flex items-center">
                        <TbLogin className="w-4 h-4 mr-1" />
                        <span>Inicia sesión</span>
                    </Link>
                </p>
            </CardFooter>
        </Card>
    );
}