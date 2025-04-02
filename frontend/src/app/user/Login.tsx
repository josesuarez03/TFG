import React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import API from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert } from "@/components/ui/alert";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string()
      .min(1, { message: 'El email es obligatorio' })
      .email({ message: 'Email inválido' }),
  password: z.string()
      .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
      .regex(/[A-Z]/, { message: 'Debe contener al menos una letra mayúscula' })
      .regex(/[a-z]/, { message: 'Debe contener al menos una letra minúscula' })
      .regex(/[0-9]/, { message: 'Debe contener al menos un número' })
      .regex(/[@$!%*?&]/, { message: 'Debe contener al menos un carácter especial (@$!%*?&)' })
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export default function Login() {
    const router = useRouter();
    const { login, error: authError, loading } = useAuth();
    
    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormInputs>({
        resolver: zodResolver(loginSchema)
    });
    
    const onSubmit = async (data: LoginFormInputs) => {
        try {
            await login(data.email, data.password);
            router.push('/dashboard');
        } catch (err) {
            console.error('Error al iniciar sesión:', err);
        }
    };


    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        try {
            await API.post('auth/google/', { token: credentialResponse.credential });
            router.push('/dashboard');
        } catch (err) {
            console.error('Error con Google login:', err);
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
            {authError && <Alert variant="destructive">{authError}</Alert>}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input type="email" {...register('email')} />
                {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
              </div>
              <div>
                  <Label>Contraseña</Label>
                  <Input type="password" {...register('password')} />
                  {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
              </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Cargando...' : 'Ingresar'}
                </Button>
            </form>
            <Separator className="my-4" />
            <div className="text-center">
              <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => console.log('Error con Google')} />
              </GoogleOAuthProvider>
            </div>
          </CardContent>
          <CardFooter className="text-center">
              <p>¿No tienes cuenta? <Link href="/register" className="text-blue-500 hover:underline">Regístrate</Link></p>
          </CardFooter>
        </Card>
    );
}
