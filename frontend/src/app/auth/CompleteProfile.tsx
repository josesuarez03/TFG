import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import API from '@/services/api';

const completeProfileSchema = z.object({
    fecha_nacimiento: z.string().min(1, { message: 'La fecha de nacimiento es obligatoria' }),
    telefono: z.string().min(1, { message: 'El teléfono es obligatorio' })
        .regex(/^\d{10}$/, { message: 'El teléfono debe tener 10 dígitos' }),
    direccion: z.string().min(1, { message: 'La dirección es obligatoria' }),
    genero: z.string().min(1, { message: 'El género es obligatorio' }),
});

const patientSchema = z.object({
    ocupacion: z.string().min(1, { message: 'La ocupación es obligatoria' }),
    allergies: z.string().optional(),
});

const doctorSchema = z.object({
    especialidad: z.string().min(1, { message: 'La especialidad es obligatoria' }),
    numero_licencia: z.string().min(1, { message: 'El número de licencia es obligatorio' })
        .regex(/^\d+$/, { message: 'El número de licencia debe ser un número' }),
});

type CompleteProfileFormData = z.infer<typeof completeProfileSchema> &
    Partial<z.infer<typeof patientSchema>> &
    Partial<z.infer<typeof doctorSchema>>;

export default function CompleteProfile() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const getValidationSchema = () => {
        if (user?.tipo === 'patient') {
            return completeProfileSchema.merge(patientSchema);
        } else if (user?.tipo === 'doctor') {
            return completeProfileSchema.merge(doctorSchema);
        }
        return completeProfileSchema;
    };

    const { register, handleSubmit, formState: { errors }, setValue, control } = useForm<CompleteProfileFormData>({
        resolver: zodResolver(getValidationSchema()),
    });

    useEffect(() => {
        if (user) {
            setValue('fecha_nacimiento', user.fecha_nacimiento || '');
            setValue('telefono', user.telefono || '');
            setValue('direccion', user.direccion || '');
            setValue('genero', user.genero || '');

            if (user.tipo === 'patient' && user.patient) {
                setValue('ocupacion' as keyof CompleteProfileFormData, user.patient.ocupacion || '');
                setValue('allergies' as keyof CompleteProfileFormData, user.patient.allergies || '');
            } else if (user.tipo === 'doctor' && user.doctor) {
                setValue('especialidad' as keyof CompleteProfileFormData, user.doctor.especialidad || '');
                setValue('numero_licencia' as keyof CompleteProfileFormData, user.doctor.numero_licencia || '');
            }
        }
    }, [user, setValue]);

    useEffect(() => {
        if (user?.is_profile_completed) {
            router.push('/dashboard');
        }
    }, [user, router]);

    const onSubmit = async (data: CompleteProfileFormData) => {
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            await API.post('/profile/complete/', data);
            setSuccess(true);
            setTimeout(() => {
                router.push('/dashboard');
            }, 1500);
        } catch (err: unknown) {
            setError('Error al completar el perfil. Inténtalo de nuevo.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

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
                        Debes iniciar sesión para completar tu perfil.
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

    return (
        <Card className="w-full max-w-md mx-auto mt-10 p-6 shadow-lg">
            <CardHeader>
                <CardTitle className="text-center">
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        width={100}
                        height={100}
                        className="mx-auto mb-4"
                    />
                    Completa tu Perfil
                </CardTitle>
            </CardHeader>
            <CardContent>
                {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
                {success && (
                    <Alert className="mb-4 bg-green-50 border-green-500">
                        <AlertDescription className="text-green-700">
                            ¡Perfil actualizado correctamente! Redirigiendo...
                        </AlertDescription>
                    </Alert>
                )}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>Fecha de Nacimiento</Label>
                            <Input type="date" {...register('fecha_nacimiento')} />
                            {errors.fecha_nacimiento && <p className="text-red-500 text-sm">{errors.fecha_nacimiento.message}</p>}
                        </div>
                        <div>
                            <Label>Género</Label>
                            <Controller
                                name="genero"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona tu género" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="masculino">Masculino</SelectItem>
                                            <SelectItem value="femenino">Femenino</SelectItem>
                                            <SelectItem value="otro">Otro</SelectItem>
                                            <SelectItem value="prefiero_no_decir">Prefiero no decir</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.genero && <p className="text-red-500 text-sm">{errors.genero.message}</p>}
                        </div>
                        <div>
                            <Label>Teléfono</Label>
                            <Input {...register('telefono')} />
                            {errors.telefono && <p className="text-red-500 text-sm">{errors.telefono.message}</p>}
                        </div>
                        <div>
                            <Label>Dirección</Label>
                            <Input {...register('direccion')} />
                            {errors.direccion && <p className="text-red-500 text-sm">{errors.direccion.message}</p>}
                        </div>
                    </div>
                    {user.tipo === 'patient' && (
                        <>
                            <div>
                                <Label>Ocupación</Label>
                                <Input {...register('ocupacion')} />
                                {errors.ocupacion && <p className="text-red-500 text-sm">{errors.ocupacion?.message}</p>}
                            </div>
                            <div>
                                <Label>Alergias (opcional)</Label>
                                <Textarea {...register('allergies')} />
                            </div>
                        </>
                    )}
                    {user.tipo === 'doctor' && (
                        <>
                            <div>
                                <Label>Especialidad</Label>
                                <Input {...register('especialidad')} />
                                {errors.especialidad && <p className="text-red-500 text-sm">{errors.especialidad?.message}</p>}
                            </div>
                            <div>
                                <Label>Número de Licencia</Label>
                                <Input {...register('numero_licencia')} />
                                {errors.numero_licencia && <p className="text-red-500 text-sm">{errors.numero_licencia?.message}</p>}
                            </div>
                        </>
                    )}
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center">
                                <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24"></svg>
                                <span className="text-white">Guardando...</span>
                            </div>
                        ) : 'Guardar y Continuar'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}