"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { completeProfile } from "@/services/api";
import {
  TbCalendarTime,
  TbPhone,
  TbMapPin,
  TbGenderBigender,
  TbBriefcase,
  TbAlertTriangle,
  TbStethoscope,
  TbLicense,
  TbCheck,
  TbLoader,
  TbUser,
  TbCircleX,
} from "react-icons/tb";
import { ROUTES } from "@/routes/routePaths";
import { useApiError } from "@/hooks/useApiError";

const completeProfileSchema = z.object({
  fecha_nacimiento: z.string().min(1, { message: "La fecha de nacimiento es obligatoria" }),
  telefono: z
    .string()
    .min(1, { message: "El teléfono es obligatorio" })
    .regex(/^\d{10}$/, { message: "El teléfono debe tener 10 dígitos" }),
  direccion: z.string().min(1, { message: "La dirección es obligatoria" }),
  genero: z.string().min(1, { message: "El género es obligatorio" }),
});

const patientSchema = z.object({
  ocupacion: z.string().optional(),
  allergies: z.string().optional(),
});

const doctorSchema = z.object({
  especialidad: z.string().min(1, { message: "La especialidad es obligatoria" }),
  numero_licencia: z
    .string()
    .min(1, { message: "El número de licencia es obligatorio" })
    .regex(/^\d+$/, { message: "El número de licencia debe ser un número" }),
});

type CompleteProfileFormData = z.infer<typeof completeProfileSchema> &
  Partial<z.infer<typeof patientSchema>> &
  Partial<z.infer<typeof doctorSchema>>;

export default function CompleteProfile() {
  const router = useRouter();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const { error, handleApiError, clearError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const getValidationSchema = () => {
    if (user?.tipo === "patient") return completeProfileSchema.merge(patientSchema);
    if (user?.tipo === "doctor") return completeProfileSchema.merge(doctorSchema);
    return completeProfileSchema;
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    reset,
  } = useForm<CompleteProfileFormData>({
    resolver: zodResolver(getValidationSchema()),
    defaultValues: {
      fecha_nacimiento: "",
      telefono: "",
      direccion: "",
      genero: "",
      ocupacion: "",
      allergies: "",
      especialidad: "",
      numero_licencia: "",
    },
  });

  useEffect(() => {
    if (!user) return;
    reset({
      fecha_nacimiento: user.fecha_nacimiento || "",
      telefono: user.telefono || "",
      direccion: user.direccion || "",
      genero: user.genero || "",
      ocupacion: user.tipo === "patient" && user.patient ? user.patient.ocupacion || "" : "",
      allergies: user.tipo === "patient" && user.patient ? user.patient.allergies || "" : "",
      especialidad: user.tipo === "doctor" && user.doctor ? user.doctor.especialidad || "" : "",
      numero_licencia: user.tipo === "doctor" && user.doctor ? user.doctor.numero_licencia || "" : "",
    });
  }, [user, reset]);

  useEffect(() => {
    if (user?.is_profile_completed) {
      router.push(ROUTES.PROTECTED.DASHBOARD);
    }
  }, [user, router]);

  const onSubmit = async (data: CompleteProfileFormData) => {
    setLoading(true);
    clearError();
    setSuccess(false);

    try {
      await completeProfile({ ...data, is_profile_completed: true });
      setSuccess(true);
      await refreshProfile();
      setTimeout(() => {
        router.push(ROUTES.PROTECTED.DASHBOARD);
      }, 1200);
    } catch (err: unknown) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <TbLoader className="animate-spin h-10 w-10 mb-3 text-primary" />
        <span className="text-muted-foreground">Cargando perfil...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="card-elevated w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <TbCircleX className="h-16 w-16 text-red-500" />
            <h2 className="text-xl font-semibold">Acceso denegado</h2>
            <p className="text-muted-foreground">Debes iniciar sesión para completar tu perfil.</p>
            <Button onClick={() => router.push(ROUTES.PUBLIC.LOGIN)}>
              <TbUser className="h-5 w-5 mr-2" />
              Iniciar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated w-full max-w-3xl mx-auto">
      <CardHeader className="pb-4 border-b">
        <div className="flex flex-col items-center text-center">
          <Image src="/assets/img/logo.png" alt="Logo" width={86} height={86} className="mb-3" />
          <CardTitle className="text-3xl font-semibold">Completa tu perfil</CardTitle>
          <p className="text-muted-foreground mt-2 max-w-xl">
            {user.tipo === "patient"
              ? "Completa estos datos para personalizar tu experiencia y mejorar la calidad del triaje."
              : "Completa tu información profesional para habilitar el uso de la plataforma."}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
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
              Perfil actualizado correctamente. Redirigiendo...
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-lg font-semibold">Datos obligatorios</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center mb-1.5">
                  <TbCalendarTime className="h-4 w-4 mr-2 text-gray-500" />
                  Fecha de nacimiento <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input type="date" {...register("fecha_nacimiento")} className={errors.fecha_nacimiento ? "border-red-300" : ""} />
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                {errors.genero && <p className="text-red-500 text-sm mt-1">{errors.genero.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center mb-1.5">
                  <TbPhone className="h-4 w-4 mr-2 text-gray-500" />
                  Teléfono <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input {...register("telefono")} placeholder="10 dígitos" className={errors.telefono ? "border-red-300" : ""} />
                <p className="text-xs text-muted-foreground mt-1">Solo números, sin espacios ni guiones.</p>
                {errors.telefono && <p className="text-red-500 text-sm mt-1">{errors.telefono.message}</p>}
              </div>

              <div>
                <Label className="flex items-center mb-1.5">
                  <TbMapPin className="h-4 w-4 mr-2 text-gray-500" />
                  Dirección <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input {...register("direccion")} placeholder="Tu dirección" className={errors.direccion ? "border-red-300" : ""} />
                {errors.direccion && <p className="text-red-500 text-sm mt-1">{errors.direccion.message}</p>}
              </div>
            </div>
          </section>

          {user.tipo === "patient" && (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold">Información adicional</h3>
              <div>
                <Label className="flex items-center mb-1.5">
                  <TbBriefcase className="h-4 w-4 mr-2 text-gray-500" />
                  Ocupación
                </Label>
                <Input {...register("ocupacion")} placeholder="Tu ocupación (opcional)" />
              </div>
              <div>
                <Label className="flex items-center mb-1.5">
                  <TbAlertTriangle className="h-4 w-4 mr-2 text-gray-500" />
                  Alergias
                </Label>
                <Textarea {...register("allergies")} placeholder="Describe tus alergias (opcional)" className="resize-y min-h-24" />
              </div>
            </section>
          )}

          {user.tipo === "doctor" && (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold">Información profesional</h3>
              <div>
                <Label className="flex items-center mb-1.5">
                  <TbStethoscope className="h-4 w-4 mr-2 text-gray-500" />
                  Especialidad <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input {...register("especialidad")} placeholder="Tu especialidad médica" className={errors.especialidad ? "border-red-300" : ""} />
                {errors.especialidad && <p className="text-red-500 text-sm mt-1">{errors.especialidad.message}</p>}
              </div>
              <div>
                <Label className="flex items-center mb-1.5">
                  <TbLicense className="h-4 w-4 mr-2 text-gray-500" />
                  Número de licencia <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input
                  {...register("numero_licencia")}
                  placeholder="Número de licencia profesional"
                  className={errors.numero_licencia ? "border-red-300" : ""}
                />
                {errors.numero_licencia && <p className="text-red-500 text-sm mt-1">{errors.numero_licencia.message}</p>}
              </div>
            </section>
          )}

          <div className="sticky bottom-0 bg-card/95 backdrop-blur py-3 border-t">
            <Button type="submit" disabled={loading} className="w-full h-11 text-base">
              {loading ? (
                <span className="flex items-center justify-center">
                  <TbLoader className="animate-spin h-5 w-5 mr-2" />
                  Guardando...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <TbCheck className="h-5 w-5 mr-2" />
                  Guardar y continuar
                </span>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
