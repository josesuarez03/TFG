"use client"

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import API from '@/services/api';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { useApiError } from '@/hooks/useApiError';
import { TbTrash, TbAlertTriangle, TbArrowLeft, TbLock, TbAlertCircle } from "react-icons/tb";

// Esquema para validar contraseña
const deleteAccountSchema = z.object({
  password: z.string().min(1, { message: 'La contraseña es obligatoria para confirmar la eliminación' }),
  confirmation: z.literal('eliminar mi cuenta', {
    message: 'Debe escribir "eliminar mi cuenta" para confirmar'
  })
});

type DeleteAccountInputs = z.infer<typeof deleteAccountSchema>;

export default function DeleteAccount() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { logout } = useAuth();
  const { error, handleApiError, clearError } = useApiError();
  
  const { register, handleSubmit, formState: { errors } } = useForm<DeleteAccountInputs>({
    resolver: zodResolver(deleteAccountSchema)
  });

  const openConfirmDialog = () => {
    setIsDialogOpen(true);
    clearError();
  };

  const handleDelete = async (data: DeleteAccountInputs) => {
    setIsSubmitting(true);
    clearError();
    
    try {
      await API.post('delete-account/', {
        password: data.password
      });
      
      // Cerrar diálogo y hacer logout
      setIsDialogOpen(false);
      logout();
      router.push('/auth/login');
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6 flex items-center justify-center">
        <TbTrash className="w-6 h-6 mr-2 text-red-500" />
        Eliminar Cuenta
      </h1>
      
      <div className="space-y-4">
        <Alert className="bg-amber-50 border-amber-200">
          <TbAlertTriangle className="w-5 h-5 inline-block mr-2 text-amber-500" />
          <AlertDescription className="text-amber-800">
            <strong>Advertencia:</strong> Esta acción eliminará permanentemente tu cuenta y todos los datos asociados.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <h3 className="font-semibold flex items-center">
            <TbAlertCircle className="w-5 h-5 mr-2 text-gray-700" />
            Consecuencias de eliminar tu cuenta:
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Todos tus datos personales serán eliminados</li>
            <li>Perderás acceso a tu historial médico</li>
            <li>Las citas programadas serán canceladas</li>
            <li>Esta acción no se puede deshacer</li>
          </ul>
        </div>
        
        <div className="flex justify-between mt-8">
          <Button 
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center"
          >
            <TbArrowLeft className="mr-2" />
            Cancelar
          </Button>
          <Button 
            variant="destructive"
            onClick={openConfirmDialog}
            className="flex items-center"
          >
            <TbTrash className="mr-2" />
            Eliminar Cuenta
          </Button>
        </div>
      </div>
      
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <TbAlertCircle className="w-5 h-5 mr-2 text-red-500" />
              ¿Estás seguro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Tu cuenta y todos tus datos serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {error && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit(handleDelete)}>
            <div className="space-y-4 my-4">
              <div>
                <Label htmlFor="password" className="flex items-center">
                  <TbLock className="w-5 h-5 mr-2 text-gray-500" />
                  Introduce tu contraseña para confirmar
                </Label>
                <Input 
                  id="password"
                  type="password" 
                  {...register('password')}
                  className={errors.password ? 'border-red-500' : ''}
                />
                {errors.password && (
                  <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="confirmation" className="flex items-center">
                  <TbAlertTriangle className="w-5 h-5 mr-2 text-gray-500" />
                  Escribe &quot;eliminar mi cuenta&quot; para confirmar
                </Label>
                <Input 
                  id="confirmation"
                  type="text" 
                  {...register('confirmation')}
                  className={errors.confirmation ? 'border-red-500' : ''}
                />
                {errors.confirmation && (
                  <p className="text-red-500 text-sm mt-1">{errors.confirmation.message}</p>
                )}
              </div>
            </div>
            
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting} className="flex items-center">
                <TbArrowLeft className="mr-2" />
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button 
                  type="submit" 
                  variant="destructive" 
                  disabled={isSubmitting}
                  className="flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24"></svg>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <TbTrash className="mr-2" />
                      Confirmar eliminación
                    </>
                  )}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}