import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/router';
import API from '@/services/api';
import { useApiError } from '@/hooks/useApiError';

// Esquema para solicitar recuperación (email)
const requestResetSchema = z.object({
  email: z.string()
    .min(1, { message: 'El email es obligatorio' })
    .email({ message: 'Email inválido' }),
});

// Esquema para restablecer la contraseña
const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    .regex(/[A-Z]/, { message: 'Debe contener al menos una letra mayúscula' })
    .regex(/[a-z]/, { message: 'Debe contener al menos una letra minúscula' })
    .regex(/[0-9]/, { message: 'Debe contener al menos un número' })
    .regex(/[@$!%*?&]/, { message: 'Debe contener al menos un carácter especial (@$!%*?&)' }),
  confirmPassword: z.string()
    .min(1, { message: 'La confirmación de contraseña es obligatoria' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RequestResetInputs = z.infer<typeof requestResetSchema>;
type ResetPasswordInputs = z.infer<typeof resetPasswordSchema>;

export default function RecoverPassword() {
  const router = useRouter();
  const { token } = router.query;
  const [mode, setMode] = useState<'request' | 'reset'>(token ? 'reset' : 'request');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { error, handleApiError, clearError } = useApiError();

  // Formulario para solicitud inicial
  const requestForm = useForm<RequestResetInputs>({
    resolver: zodResolver(requestResetSchema),
  });

  // Formulario para restablecer contraseña
  const resetForm = useForm<ResetPasswordInputs>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // Detectar token en la URL
  useEffect(() => {
    if (token) {
      setMode('reset');
    }
  }, [token]);

  // Manejar solicitud de recuperación
  const onRequestSubmit = async (data: RequestResetInputs) => {
    setIsSubmitting(true);
    clearError();
    setSuccessMessage(null);

    try {
      await API.post('password-reset-request/', {
        email: data.email
      });

      setSuccessMessage('Te hemos enviado un correo con instrucciones para restablecer tu contraseña');
      requestForm.reset();
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar restablecimiento de contraseña
  const onResetSubmit = async (data: ResetPasswordInputs) => {
    if (!token) {
      handleApiError(new Error('Token inválido o expirado'));
      return;
    }

    setIsSubmitting(true);
    clearError();
    setSuccessMessage(null);

    try {
      await API.post('password-reset-confirm/', {
        token: token,
        password: data.password
      });

      setSuccessMessage('Contraseña restablecida con éxito');
      
      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6">
        {mode === 'request' ? 'Recuperar Contraseña' : 'Restablecer Contraseña'}
      </h1>

      {successMessage && (
        <Alert variant="default" className="mb-4">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {mode === 'request' ? (
        // Formulario de solicitud
        <form onSubmit={requestForm.handleSubmit(onRequestSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email"
              type="email" 
              {...requestForm.register('email')} 
              className={requestForm.formState.errors.email ? 'border-red-500' : ''}
            />
            {requestForm.formState.errors.email && (
              <p className="text-red-500 text-sm mt-1">{requestForm.formState.errors.email.message}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Correo de Recuperación'}
          </Button>

          <p className="text-center text-sm mt-4">
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                router.push('/auth/login');
              }}
              className="text-blue-600 hover:underline"
            >
              Volver al login
            </a>
          </p>
        </form>
      ) : (
        // Formulario de restablecimiento
        <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="password">Nueva Contraseña</Label>
            <Input 
              id="password"
              type="password" 
              {...resetForm.register('password')} 
              className={resetForm.formState.errors.password ? 'border-red-500' : ''}
            />
            {resetForm.formState.errors.password && (
              <p className="text-red-500 text-sm mt-1">{resetForm.formState.errors.password.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
            <Input 
              id="confirmPassword"
              type="password" 
              {...resetForm.register('confirmPassword')} 
              className={resetForm.formState.errors.confirmPassword ? 'border-red-500' : ''}
            />
            {resetForm.formState.errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{resetForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Restableciendo...' : 'Restablecer Contraseña'}
          </Button>
        </form>
      )}
    </div>
  );
}