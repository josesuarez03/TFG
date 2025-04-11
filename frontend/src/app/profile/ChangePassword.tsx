import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import API from '@/services/api';
import { useRouter } from 'next/router';
import { useApiError } from '@/hooks/useApiError';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'La contraseña actual es obligatoria' }),
  newPassword: z.string()
    .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    .regex(/[A-Z]/, { message: 'Debe contener al menos una letra mayúscula' })
    .regex(/[a-z]/, { message: 'Debe contener al menos una letra minúscula' })
    .regex(/[0-9]/, { message: 'Debe contener al menos un número' })
    .regex(/[@$!%*?&]/, { message: 'Debe contener al menos un carácter especial (@$!%*?&)' }),
  confirmPassword: z.string()
    .min(1, { message: 'La confirmación de contraseña es obligatoria' }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type ChangePasswordInputs = z.infer<typeof changePasswordSchema>;

export default function ChangePassword() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ChangePasswordInputs>({
    resolver: zodResolver(changePasswordSchema),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { error, handleApiError, clearError } = useApiError();
  const router = useRouter();

  const onSubmit = async (data: ChangePasswordInputs) => {
    setIsSubmitting(true);
    clearError();
    setSuccessMessage(null);

    try {
      await API.post('change-password/', {
        current_password: data.currentPassword,
        new_password: data.newPassword,
      });
      
      setSuccessMessage('Contraseña actualizada con éxito');
      reset();
      
      // Redirigir al perfil después de 2 segundos
      setTimeout(() => {
        router.push('/profile');
      }, 2000);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6">Cambiar Contraseña</h1>
      
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
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="currentPassword">Contraseña Actual</Label>
          <Input 
            id="currentPassword"
            type="password" 
            {...register('currentPassword')} 
            className={errors.currentPassword ? 'border-red-500' : ''}
          />
          {errors.currentPassword && (
            <p className="text-red-500 text-sm mt-1">{errors.currentPassword.message}</p>
          )}
        </div>
        
        <div>
          <Label htmlFor="newPassword">Nueva Contraseña</Label>
          <Input 
            id="newPassword"
            type="password" 
            {...register('newPassword')} 
            className={errors.newPassword ? 'border-red-500' : ''}
          />
          {errors.newPassword && (
            <p className="text-red-500 text-sm mt-1">{errors.newPassword.message}</p>
          )}
        </div>
        
        <div>
          <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
          <Input 
            id="confirmPassword"
            type="password" 
            {...register('confirmPassword')} 
            className={errors.confirmPassword ? 'border-red-500' : ''}
          />
          {errors.confirmPassword && (
            <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>
        
        <div className="flex justify-between mt-6">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Cambiando...' : 'Cambiar Contraseña'}
          </Button>
        </div>
      </form>
    </div>
  );
}