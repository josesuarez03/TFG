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
import API from '@/services/api';
import { 
  TbBrandGoogle, 
  TbLock, 
  TbMail, 
  TbUser, 
  TbUsers, 
  TbLoader,
  TbAlertTriangle,
  TbLogin,
  TbUserCircle,
  TbCheckbox
} from "react-icons/tb";
import { ROUTES } from '@/routes/routePaths';

const registerSchema = z.object({
    email: z.string()
        .min(1, { message: 'El email es obligatorio' })
        .email({ message: 'Email inválido' })
        .regex(
            /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
            { message: 'El email debe tener un formato válido (ejemplo@dominio.com)' }
      ),
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
    const [googleLoginButtonRef, setGoogleLoginButtonRef] = useState<HTMLDivElement | null>(null);
    
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
            // Guardar en localStorage cuando haya un tipo válido
            localStorage.setItem('selectedProfileType', type);
            setValue('tipo', type);
        }
    }, [type, router, setValue]);

    const onSubmit = async (data: RegisterFormInputs) => {
        try {
            setLoading(true);
            setError(null);
            // Llamar a la API para registrar al usuario
            const response = await API.post('register/', {
                email: data.email,
                password: data.password,
                first_name: data.first_name,
                last_name: data.last_name,
                tipo: data.tipo
            });
            
            // Si el registro es exitoso, iniciar sesión automáticamente
            if (response.status === 201) {
                await login(data.email, data.password);
            }
        } catch (err) {
            console.error('Error al registrar:', err);
            setError(err instanceof Error ? err.message : "Error al registrar usuario");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        if (!credentialResponse.credential) return;

        try {
            setGoogleError(null);
            // Obtener el tipo de usuario actual y pasarlo a loginWithGoogle
            const profileType = type || 'patient';
            await loginWithGoogle(credentialResponse.credential, profileType);
        } catch (err) {
            console.error("Error con Google login:", err);
            setGoogleError("Error al iniciar sesión con Google. Por favor intenta nuevamente.");
        }
    };

    const handleGoogleError = () => {
        console.log('Error con Google login');
        setGoogleError("Error al iniciar sesión con Google. Por favor intenta nuevamente.");
    };

    // Mostrar texto basado en el tipo de usuario
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
            {(authError || error || googleError) && (
                <Alert variant="destructive" className="mb-4">
                    <AlertDescription className="flex items-center">
                        <TbAlertTriangle className="w-5 h-5 mr-2" />
                        <span>{authError || error || googleError}</span>
                    </AlertDescription>
                </Alert>
            )}
          
            {/* Botón de Google con el proveedor correctamente configurado */}
            <GoogleOAuthProvider 
                clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}
            >
                <div className="mb-4">
                    <Button 
                        type="button"
                        className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-gray-100 text-gray-800 border border-gray-300"
                        onClick={() => {
                            if (googleLoginButtonRef) {
                                // Trigger the hidden Google button's click event
                                const buttons = googleLoginButtonRef.querySelectorAll('button');
                                if (buttons && buttons.length > 0) {
                                    buttons[0].click();
                                } else {
                                    setGoogleError("Error al iniciar sesión con Google. Por favor intenta nuevamente.");
                                }
                            } else {
                                setGoogleError("Error al iniciar botón de Google. Inténtalo nuevamente.");
                            }
                        }}
                    >
                        <TbBrandGoogle className="w-5 h-5" />
                        <span>Registrarse con Google</span>
                    </Button>
                    
                    <div ref={setGoogleLoginButtonRef} style={{ display: 'none' }}>
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            useOneTap={false}
                            auto_select={false}
                            theme="outline"
                            text="signin_with"
                            shape="rectangular"
                            size="large"
                            locale="es"
                            ux_mode="popup"
                            context="signup"
                        />
                    </div>
                </div>
            </GoogleOAuthProvider>
            
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
                
                <Button type="submit" disabled={loading || authLoading} className="w-full flex items-center justify-center">
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
                <p className="flex items-center justify-center">
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