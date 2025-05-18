"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { TbLock, TbUser, TbBrandGoogle, TbLoader, TbAlertTriangle, TbLogin } from 'react-icons/tb';
import { ROUTES } from '@/routes/routePaths';
import { syncAuthState } from '@/utils/authSync';

const loginSchema = z.object({
  username_or_email: z.string()
      .min(1, { message: 'El usuario o email es obligatorio' }),
  password: z.string()
      .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
      .regex(/[A-Z]/, { message: 'Debe contener al menos una letra mayúscula' })
      .regex(/[a-z]/, { message: 'Debe contener al menos una letra minúscula' })
      .regex(/[0-9]/, { message: 'Debe contener al menos un número' })
      .regex(/[@$!%*?&.]/, { message: 'Debe contener al menos un carácter especial (@$!%*?&.)' })
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export default function Login() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromRoute = searchParams.get('from');
    
    const { login, loginWithGoogle, error: authError, loading, isAuthenticated, user } = useAuth();
    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormInputs>({
        resolver: zodResolver(loginSchema)
    });
    const [googleError, setGoogleError] = useState<string | null>(null);
    const [googleLoginButtonRef, setGoogleLoginButtonRef] = useState<HTMLDivElement | null>(null);
    const [redirecting, setRedirecting] = useState(false);

    // Force sync auth state when component mounts
    useEffect(() => {
        syncAuthState();
    }, []);

    // Función de redirección basada en el estado del perfil
    const redirectBasedOnProfileStatus = React.useCallback(() => {
        if (!isAuthenticated || !user) return;
        
        console.log('Verificando estado de perfil:', user);
        console.log('¿Perfil completado?', user.is_profile_completed);
        
        // Evitar múltiples redirecciones
        if (redirecting) return;
        setRedirecting(true);
        
        if (!user.is_profile_completed) {
            console.log('Redirigiendo a completar perfil');
            router.push(ROUTES.PROTECTED.PROFILE_COMPLETE);
        } else if (fromRoute && fromRoute !== ROUTES.PUBLIC.LOGIN) {
            console.log('Redirigiendo a la ruta original:', fromRoute);
            router.push(fromRoute);
        } else {
            console.log('Redirigiendo al dashboard');
            router.push(ROUTES.PROTECTED.DASHBOARD);
        }
    }, [isAuthenticated, user, redirecting, router, fromRoute]);

    // Verificar autenticación y estado del perfil cuando cambian
    useEffect(() => {
        if (isAuthenticated && user) {
            console.log('Usuario autenticado y perfil cargado, preparando redirección...');
            // Add a small delay to ensure all state updates have propagated
            const timeout = setTimeout(() => {
                redirectBasedOnProfileStatus();
            }, 100);
            return () => clearTimeout(timeout);
        }
    }, [isAuthenticated, user, redirectBasedOnProfileStatus]);

    // Manejar el envío manual del formulario de login
    const onSubmit = async (data: LoginFormInputs) => {
        try {
            await login(data.username_or_email, data.password);
            // Force sync auth state immediately after login
            syncAuthState();
        } catch (err) {
            console.error('Error al iniciar sesión:', err);
        }
    };

    // Manejar el inicio de sesión con Google
    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        if (!credentialResponse.credential) return;

        try {
            setGoogleError(null);
            // Obtener el tipo de perfil del localStorage (si existe)
            const profileType = localStorage.getItem('selectedProfileType') || 'patient';
            await loginWithGoogle(credentialResponse.credential, profileType);
            // Force sync auth state immediately after Google login
            syncAuthState();
        } catch (err) {
            console.error("Error con Google login:", err);
            setGoogleError("Error al iniciar sesión con Google. Por favor intenta nuevamente.");
        }
    };

    const handleGoogleError = () => {
        console.log('Error con Google login');
        setGoogleError("Error al iniciar sesión con Google. Por favor intenta nuevamente.");
    };

    return (
        <Card className="w-full max-w-sm mx-auto mt-10 p-6 shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">
                <Image
                    src="/assets/img/logo.png"
                    alt="Logo"
                    width={100}
                    height={100}
                    className="mx-auto mb-4"
                />
                Iniciar sesión
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(authError || googleError) && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription className="flex items-center">
                    <TbAlertTriangle className="w-5 h-5 mr-2" />
                    <span>{authError || googleError}</span>
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
                                // Trigger the hidden Google button directly
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
                        <span>Iniciar sesión con Google</span>
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
                        />
                    </div>
                </div>
            </GoogleOAuthProvider>
            
            <Separator className="my-4" />
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label className="flex items-center">
                  <TbUser className="w-5 h-5 mr-2 text-gray-500" />
                  Usuario o Email
                </Label>
                <Input type="text" {...register('username_or_email')} />
                {errors.username_or_email && <p className="text-red-500 text-sm">{errors.username_or_email.message}</p>}
              </div>
              <div className="relative">
                  <Label className="flex items-center">
                      <TbLock className="w-5 h-5 mr-2 text-gray-500" />
                      Contraseña
                  </Label>
                  <Input type="password" {...register('password')} />
                    {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
                  <Link 
                      href={`${ROUTES.PUBLIC.RECOVER_PASSWORD}?fromLogin=true`}
                      className="absolute right-0 top-0 text-sm text-blue-500 hover:underline mt-1"
                  >
                      ¿Olvidaste tu contraseña?
                  </Link>
              </div>
                <Button type="submit" disabled={loading} className="w-full flex items-center justify-center space-x-2">
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <TbLoader className="animate-spin h-5 w-5 mr-3 text-white" />
                      <span className="text-white">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <TbLogin className="w-5 h-5 text-white" />
                      <span>Ingresar</span>
                    </>
                  )}
                </Button>
            </form>
          </CardContent>
          <CardFooter className="text-center">
              <p className="flex items-center justify-center">
                ¿No tienes cuenta? 
                <Link href={ROUTES.PUBLIC.PROFILE_TYPE} className="text-blue-500 hover:underline ml-2 flex items-center">
                  <TbUser className="w-4 h-4 mr-1" />
                  <span>Regístrate</span>
                </Link>
              </p>
          </CardFooter>
        </Card>
    );
}