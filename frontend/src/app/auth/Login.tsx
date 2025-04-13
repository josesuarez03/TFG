import React from 'react';
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
import { TbMail, TbLock, TbUser, TbBrandGoogle } from 'react-icons/tb';

const loginSchema = z.object({
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
      .regex(/[@$!%*?&]/, { message: 'Debe contener al menos un carácter especial (@$!%*?&)' })
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export default function Login() {
    const { login, loginWithGoogle, error: authError, loading } = useAuth();
    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormInputs>({
        resolver: zodResolver(loginSchema)
    });

    // Manejo del formulario de inicio de sesión
    const onSubmit = async (data: LoginFormInputs) => {
        try {
            await login(data.email, data.password);
        } catch (err) {
            console.error('Error al iniciar sesión:', err);
        }
    };

    // Manejo del inicio de sesión con Google
    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        if (!credentialResponse.credential) return;

        try {
            await loginWithGoogle(credentialResponse.credential);
        } catch (err) {
            console.error("Error con Google login:", err);
        }
    };
    
    // Referencia para el botón de Google OAuth nativo (oculto)
    const googleButtonRef = React.useRef<HTMLDivElement>(null);

    // Función para hacer clic en el botón de Google oculto
    const triggerGoogleLogin = () => {
        const googleButton = googleButtonRef.current?.querySelector('button');
        if (googleButton) {
            googleButton.click();
        }
    };

    return (
        <Card className="w-full max-w-sm mx-auto mt-10 p-6 shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">
                <Image
                    src="/logo.png"
                    alt="Logo"
                    width={100}
                    height={100}
                    className="mx-auto mb-4"
                />
                Iniciar sesión
            </CardTitle>
          </CardHeader>
          <CardContent>
            {authError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>
                  <TbMail className="w-5 h-5 inline-block mr-2 text-gray-500" />
                  Email
                </Label>
                <Input type="email" {...register('email')} />
                {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
              </div>
              <div className="relative">
                  <Label>
                      <TbLock className="w-5 h-5 inline-block mr-2 text-gray-500" />
                      Contraseña
                  </Label>
                  <Input type="password" {...register('password')} />
                    {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
                  <Link 
                      href="/auth/recover-password" 
                      className="absolute right-0 top-0 text-sm text-blue-500 hover:underline mt-1"
                  >
                      ¿Olvidaste tu contraseña?
                  </Link>
              </div>
                <Button type="submit" disabled={loading} className="w-full flex items-center justify-center space-x-2">
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24"></svg>
                      <span className="text-white">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <TbUser className="w-5 h-5 text-white" />
                      <span>Ingresar</span>
                    </>
                  )}
                </Button>
            </form>
            <Separator className="my-4" />
            
            {/* Botón de Google personalizado */}
            <Button 
              onClick={triggerGoogleLogin} 
              className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-gray-100 text-gray-800 border border-gray-300"
            >
              <TbBrandGoogle className="w-5 h-5" />
              <span>Iniciar sesión con Google</span>
            </Button>
            
            {/* Botón de Google real (oculto) */}
            <div ref={googleButtonRef} className="hidden">
              <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => console.log('Error con Google')}
                  useOneTap
                  type="icon"
                  size="medium"
                />
              </GoogleOAuthProvider>
            </div>
          </CardContent>
          <CardFooter className="text-center">
              <p>¿No tienes cuenta? <Link href="/auth/register" className="text-blue-500 hover:underline">Regístrate</Link></p>
          </CardFooter>
        </Card>
    );
}