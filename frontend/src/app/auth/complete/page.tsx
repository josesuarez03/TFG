"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { completeProfile } from '@/services/api'; // Import the new function
import { TbCalendarTime, TbPhone, TbMapPin, TbGenderBigender, TbBriefcase, TbAlertTriangle, TbStethoscope, TbLicense, TbCheck, TbLoader, TbUser, TbCircleX } from "react-icons/tb";
import { ROUTES } from '@/routes/routePaths';
import { useApiError } from '@/hooks/useApiError';

// Esquema base para todos los usuarios
const completeProfileSchema = z.object({
    fecha_nacimiento: z.string().min(1, { message: 'La fecha de nacimiento es obligatoria' }),
    telefono: z.string().min(1, { message: 'El teléfono es obligatorio' })
        .regex(/^\d{10}$/, { message: 'El teléfono debe tener 10 dígitos' }),
    direccion: z.string().min(1, { message: 'La dirección es obligatoria' }),
    genero: z.string().min(1, { message: 'El género es obligatorio' }),
});

// Esquema para pacientes (con campos opcionales)
const patientSchema = z.object({
    ocupacion: z.string().optional(),
    allergies: z.string().optional(),
});

// Esquema para doctores (con campos obligatorios)
const doctorSchema = z.object({
    especialidad: z.string().min(1, { message: 'La especialidad es obligatoria' }),
    numero_licencia: z.string().min(1, { message: 'El número de licencia es obligatorio' })
        .regex(/^\d+$/, { message: 'El número de licencia debe ser un número' }),
});

// Tipo combinado para el formulario
type CompleteProfileFormData = z.infer<typeof completeProfileSchema> &
    Partial<z.infer<typeof patientSchema>> &
    Partial<z.infer<typeof doctorSchema>>;

export default function CompleteProfile() {
    const router = useRouter();
    const { user, loading: authLoading, refreshProfile } = useAuth();
    const { error, handleApiError, clearError } = useApiError();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Determinar el esquema de validación según el tipo de usuario
    const getValidationSchema = () => {
        if (user?.tipo === 'patient') {
            return completeProfileSchema.merge(patientSchema);
        } else if (user?.tipo === 'doctor') {
            return completeProfileSchema.merge(doctorSchema);
        }
        return completeProfileSchema;
    };

    const { register, handleSubmit, formState: { errors }, control, reset } = useForm<CompleteProfileFormData>({
        resolver: zodResolver(getValidationSchema()),
        defaultValues: {
            fecha_nacimiento: '',
            telefono: '',
            direccion: '',
            genero: '',
            ocupacion: '',
            allergies: '',
            especialidad: '',
            numero_licencia: '',
        }
    });

    // Actualizar el formulario cuando se cargan los datos del usuario
    useEffect(() => {
        if (user) {
            console.log('Cargando datos de usuario en el formulario:', user);
            reset({
                fecha_nacimiento: user.fecha_nacimiento || '',
                telefono: user.telefono || '',
                direccion: user.direccion || '',
                genero: user.genero || '',
                ocupacion: user.tipo === 'patient' && user.patient ? user.patient.ocupacion || '' : '',
                allergies: user.tipo === 'patient' && user.patient ? user.patient.allergies || '' : '',
                especialidad: user.tipo === 'doctor' && user.doctor ? user.doctor.especialidad || '' : '',
                numero_licencia: user.tipo === 'doctor' && user.doctor ? user.doctor.numero_licencia || '' : '',
            });
        }
    }, [user, reset]);

    // Redirigir si el perfil ya está completo
    useEffect(() => {
        if (user?.is_profile_completed) {
            console.log('Perfil ya completo, redirigiendo al dashboard...');
            router.push(ROUTES.PROTECTED.DASHBOARD);
        }
    }, [user, router]);

    // Manejar el envío del formulario
    const onSubmit = async (data: CompleteProfileFormData) => {
        setLoading(true);
        clearError();
        setSuccess(false);

        try {
            console.log('Enviando datos del formulario:', data);

            // Añadir el campo is_profile_completed a los datos enviados
            const completeData = {
                ...data,
                is_profile_completed: true
            };

            // Usar la función dedicada para completar el perfil
            await completeProfile(completeData);
            setSuccess(true);

            // Actualizar el perfil de usuario después de completarlo
            await refreshProfile();

            setTimeout(() => {
                router.push(ROUTES.PROTECTED.DASHBOARD);
            }, 1500);
        } catch (err: unknown) {
            // Usar el hook para manejar el error
            handleApiError(err);
            console.error('Error al completar perfil:', err);
        } finally {
            setLoading(false);
        }
    };

    // Mostrar pantalla de carga mientras se verifica la autenticación
    if (authLoading) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
                <TbLoader className="animate-spin h-12 w-12 mb-4 text-primary" />
                <span className="text-lg text-gray-700">Cargando perfil...</span>
            </div>
        );
    }

    // Mostrar mensaje si el usuario no está autenticado
    if (!user) {
        return (
            <Card className="w-full max-w-md shadow-lg">
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <TbCircleX className="h-16 w-16 text-red-500" />
                        <h2 className="text-xl font-semibold">Acceso Denegado</h2>
                        <p className="text-gray-600">
                            Debes iniciar sesión para completar tu perfil.
                        </p>
                        <Button
                            onClick={() => router.push(ROUTES.PUBLIC.LOGIN)}
                            className="mt-4"
                        >
                            <TbUser className="h-5 w-5 mr-2" />
                            Iniciar Sesión
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-lg mx-auto shadow-lg">
            <CardHeader className="pb-2">
                <div className="flex flex-col items-center">
                    <Image
                        src="/assets/img/logo.png"
                        alt="Logo"
                        width={80}
                        height={80}
                        className="mb-3"
                    />
                    <CardTitle className="text-2xl font-bold text-center">
                        Completa tu Perfil
                    </CardTitle>
                    <p className="text-gray-500 text-center mt-1">
                        {user.tipo === 'patient'
                            ? 'Necesitamos algunos datos para personalizar tu experiencia'
                            : 'Necesitamos información sobre tu práctica médica'}
                    </p>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertDescription className="flex items-center">
                            <TbCircleX className="h-5 w-5 mr-2" />
                            {error.message}
                        </AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert className="mb-4 bg-green-50 border-green-500">
                        <AlertDescription className="text-green-700 flex items-center">
                            <TbCheck className="h-5 w-5 mr-2 text-green-500" />
                            ¡Perfil actualizado correctamente! Redirigiendo...
                        </AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Información básica del usuario */}
                            <div>
                                <Label className="flex items-center mb-1.5">
                                    <TbCalendarTime className="h-4 w-4 mr-2 text-gray-500" />
                                    Fecha de Nacimiento <span className="text-red-500 ml-1">*</span>
                                </Label>
                                <Input
                                    type="date"
                                    {...register('fecha_nacimiento')}
                                    className={errors.fecha_nacimiento ? "border-red-300" : ""}
                                />
                                {errors.fecha_nacimiento && (
                                    <p className="text-red-500 text-sm mt-1">{errors.fecha_nacimiento.message}</p>
                                )}
                            </div>

                            <div>
                                <Label className="flex items-center mb-1.5">
                                    <TbGenderBigender className="h-4 w-4 mr-2 text-gray-500" />
                                    Género <span className="text-red-500 ml-1">*</span>
                                </Label>
                                <Controller
                                    name="genero"
                                    control={control}
                                    render={({ field }) => (
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                        >
                                            <SelectTrigger className={errors.genero ? "border-red-300" : ""}>
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
                                {errors.genero && (
                                    <p className="text-red-500 text-sm mt-1">{errors.genero.message}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label className="flex items-center mb-1.5">
                                    <TbPhone className="h-4 w-4 mr-2 text-gray-500" />
                                    Teléfono <span className="text-red-500 ml-1">*</span>
                                </Label>
                                <Input
                                    {...register('telefono')}
                                    placeholder="10 dígitos"
                                    className={errors.telefono ? "border-red-300" : ""}
                                />
                                {errors.telefono && (
                                    <p className="text-red-500 text-sm mt-1">{errors.telefono.message}</p>
                                )}
                            </div>

                            <div>
                                <Label className="flex items-center mb-1.5">
                                    <TbMapPin className="h-4 w-4 mr-2 text-gray-500" />
                                    Dirección <span className="text-red-500 ml-1">*</span>
                                </Label>
                                <Input
                                    {...register('direccion')}
                                    placeholder="Tu dirección"
                                    className={errors.direccion ? "border-red-300" : ""}
                                />
                                {errors.direccion && (
                                    <p className="text-red-500 text-sm mt-1">{errors.direccion.message}</p>
                                )}
                            </div>
                        </div>

                        {/* Campos específicos para pacientes */}
                        {user.tipo === 'patient' && (
                            <div className="space-y-4 pt-2">
                                <h3 className="text-sm font-medium text-gray-500">INFORMACIÓN ADICIONAL</h3>
                                <div>
                                    <Label className="flex items-center mb-1.5">
                                        <TbBriefcase className="h-4 w-4 mr-2 text-gray-500" />
                                        Ocupación
                                    </Label>
                                    <Input
                                        {...register('ocupacion')}
                                        placeholder="Tu ocupación (opcional)"
                                    />
                                </div>
                                <div>
                                    <Label className="flex items-center mb-1.5">
                                        <TbAlertTriangle className="h-4 w-4 mr-2 text-gray-500" />
                                        Alergias
                                    </Label>
                                    <Textarea
                                        {...register('allergies')}
                                        placeholder="Describe tus alergias (opcional)"
                                        className="resize-none"
                                        rows={3}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Campos específicos para doctores */}
                        {user.tipo === 'doctor' && (
                            <div className="space-y-4 pt-2">
                                <h3 className="text-sm font-medium text-gray-500">INFORMACIÓN PROFESIONAL</h3>
                                <div>
                                    <Label className="flex items-center mb-1.5">
                                        <TbStethoscope className="h-4 w-4 mr-2 text-gray-500" />
                                        Especialidad <span className="text-red-500 ml-1">*</span>
                                    </Label>
                                    <Input
                                        {...register('especialidad')}
                                        placeholder="Tu especialidad médica"
                                        className={errors.especialidad ? "border-red-300" : ""}
                                    />
                                    {errors.especialidad && (
                                        <p className="text-red-500 text-sm mt-1">{errors.especialidad?.message}</p>
                                    )}
                                </div>
                                <div>
                                    <Label className="flex items-center mb-1.5">
                                        <TbLicense className="h-4 w-4 mr-2 text-gray-500" />
                                        Número de Licencia <span className="text-red-500 ml-1">*</span>
                                    </Label>
                                    <Input
                                        {...register('numero_licencia')}
                                        placeholder="Número de licencia profesional"
                                        className={errors.numero_licencia ? "border-red-300" : ""}
                                    />
                                    {errors.numero_licencia && (
                                        <p className="text-red-500 text-sm mt-1">{errors.numero_licencia?.message}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-6"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center">
                                <TbLoader className="animate-spin h-5 w-5 mr-3" />
                                <span>Guardando...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center">
                                <TbCheck className="h-5 w-5 mr-2" />
                                <span>Guardar y Continuar</span>
                            </div>
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}