"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { register as apiRegister } from "@/services/api";
import axios from "axios";
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
  TbCheckbox,
  TbAt,
} from "react-icons/tb";
import { ROUTES } from "@/routes/routePaths";
import { UserProfile } from "@/types/user";

const registerSchema = z
  .object({
    email: z.string().min(1, { message: "El email es obligatorio" }).email({ message: "Email inválido" }),
    username: z
      .string()
      .min(3, { message: "El nombre de usuario debe tener al menos 3 caracteres" })
      .max(30, { message: "El nombre de usuario no puede exceder los 30 caracteres" })
      .regex(/^[a-zA-Z0-9_]+$/, {
        message: "El nombre de usuario solo puede contener letras, números y guiones bajos",
      }),
    password: z
      .string()
      .min(8, { message: "La contraseña debe tener al menos 8 caracteres" })
      .regex(/[A-Z]/, { message: "Debe contener al menos una letra mayúscula" })
      .regex(/[a-z]/, { message: "Debe contener al menos una letra minúscula" })
      .regex(/[0-9]/, { message: "Debe contener al menos un número" })
      .regex(/[@$!%*?&]/, { message: "Debe contener al menos un carácter especial (@$!%*?&)" }),
    confirmPassword: z.string().min(1, { message: "La confirmación de contraseña es obligatoria" }),
    first_name: z
      .string()
      .min(1, { message: "El nombre es obligatorio" })
      .regex(/^[a-zA-Z\s]+$/, { message: "El nombre solo puede contener letras y espacios" })
      .max(50, { message: "El nombre no puede exceder los 50 caracteres" }),
    last_name: z
      .string()
      .min(1, { message: "El apellido es obligatorio" })
      .regex(/^[a-zA-Z\s]+$/, { message: "El apellido solo puede contener letras y espacios" })
      .max(50, { message: "El apellido no puede exceder los 50 caracteres" }),
    tipo: z.string().min(1, { message: "El tipo de usuario es obligatorio" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type RegisterFormInputs = z.infer<typeof registerSchema>;

export default function Register() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const { loginWithGoogle, error: authError, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<RegisterFormInputs>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      tipo: type || "patient",
    },
  });

  useEffect(() => {
    if (!type) {
      router.push(ROUTES.PUBLIC.PROFILE_TYPE);
    } else {
      localStorage.setItem("selectedProfileType", type);
      setValue("tipo", type);
    }
  }, [type, router, setValue]);

  const redirectAfterAuth = (profile: UserProfile | null) => {
    if (!profile) return;
    if (!profile.is_profile_completed) {
      router.push(ROUTES.PUBLIC.PROFILE_COMPLETE);
      return;
    }
    router.push(ROUTES.PROTECTED.DASHBOARD);
  };

  const onSubmit = async (data: RegisterFormInputs) => {
    setLoading(true);
    setError(null);

    const registerData = {
      email: data.email,
      username: data.username,
      password: data.password,
      password2: data.confirmPassword,
      first_name: data.first_name,
      last_name: data.last_name,
      tipo: data.tipo,
    };

    try {
      await apiRegister(registerData);
      router.push(ROUTES.PUBLIC.LOGIN);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (!err.response) {
          setError("No se puede conectar al servidor. Verifica tu conexión.");
        } else {
          const errorData = err.response.data;
          let errorMessage = "Error en el registro. Revisa tus datos.";
          if (typeof errorData === "object" && errorData !== null) {
            errorMessage =
              errorData.detail ||
              errorData.email?.[0] ||
              errorData.username?.[0] ||
              errorData.non_field_errors?.[0] ||
              errorMessage;
          }
          setError(errorMessage);
        }
      } else {
        setError("Error desconocido. Inténtalo nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential || googleLoading) {
      setGoogleError("No se pudo obtener credenciales de Google.");
      return;
    }

    try {
      setGoogleLoading(true);
      setGoogleError(null);
      const profileType = localStorage.getItem("selectedProfileType") || "patient";
      const profile = await loginWithGoogle(credentialResponse.credential, profileType);
      redirectAfterAuth(profile);
    } finally {
      setGoogleLoading(false);
    }
  };

  const getUserTypeText = () => (type === "doctor" ? "Médico" : "Paciente");
  const googleUnavailable = useMemo(() => !googleClientId || googleClientId.trim().length === 0, [googleClientId]);

  return (
    <Card className="card-elevated w-full max-w-md mx-auto p-4 sm:p-6">
      <CardHeader>
        <CardTitle className="text-center">
          <Image src="/assets/img/logo.png" alt="Logo" width={96} height={96} className="mx-auto mb-3" />
          <div className="flex items-center justify-center text-2xl font-semibold">
            {type === "doctor" ? (
              <TbUserCircle className="w-7 h-7 mr-2 text-blue-500" />
            ) : (
              <TbUsers className="w-7 h-7 mr-2 text-blue-500" />
            )}
            Registro como {getUserTypeText()}
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

        <div className="mb-4">
          {googleUnavailable ? (
            <Button type="button" variant="secondary" className="w-full" disabled>
              <TbBrandGoogle className="w-5 h-5 mr-2" />
              Google no disponible
            </Button>
          ) : (
            <GoogleOAuthProvider clientId={googleClientId}>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setGoogleError("Error al iniciar sesión con Google. Intenta nuevamente.")}
                  useOneTap={false}
                  auto_select={false}
                  theme="outline"
                  text="signup_with"
                  shape="rectangular"
                  size="large"
                  locale="es"
                  context="signup"
                  ux_mode="popup"
                />
              </div>
              {googleLoading && (
                <p className="text-center text-sm text-muted-foreground mt-2">Validando sesión con Google...</p>
              )}
            </GoogleOAuthProvider>
          )}
        </div>

        <Separator className="my-4" />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="flex items-center">
              <TbMail className="w-5 h-5 mr-2 text-gray-500" />
              Email
            </Label>
            <Input type="email" {...register("email")} />
            {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
          </div>
          <div>
            <Label className="flex items-center">
              <TbAt className="w-5 h-5 mr-2 text-gray-500" />
              Nombre de usuario
            </Label>
            <Input type="text" {...register("username")} />
            {errors.username && <p className="text-red-500 text-sm">{errors.username.message}</p>}
          </div>
          <div>
            <Label className="flex items-center">
              <TbUser className="w-5 h-5 mr-2 text-gray-500" />
              Nombre
            </Label>
            <Input type="text" {...register("first_name")} />
            {errors.first_name && <p className="text-red-500 text-sm">{errors.first_name.message}</p>}
          </div>
          <div>
            <Label className="flex items-center">
              <TbUsers className="w-5 h-5 mr-2 text-gray-500" />
              Apellido
            </Label>
            <Input type="text" {...register("last_name")} />
            {errors.last_name && <p className="text-red-500 text-sm">{errors.last_name.message}</p>}
          </div>
          <div>
            <Label className="flex items-center">
              <TbLock className="w-5 h-5 mr-2 text-gray-500" />
              Contraseña
            </Label>
            <Input type="password" {...register("password")} />
            {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
          </div>
          <div>
            <Label className="flex items-center">
              <TbCheckbox className="w-5 h-5 mr-2 text-gray-500" />
              Confirmar Contraseña
            </Label>
            <Input type="password" {...register("confirmPassword")} />
            {errors.confirmPassword && <p className="text-red-500 text-sm">{errors.confirmPassword.message}</p>}
          </div>

          <input type="hidden" {...register("tipo")} />

          <Button type="submit" className="w-full" disabled={loading || authLoading || googleLoading}>
            {loading || authLoading ? (
              <>
                <TbLoader className="animate-spin h-5 w-5 mr-2" />
                Cargando...
              </>
            ) : (
              <>
                <TbLogin className="w-5 h-5 mr-2" />
                Registrarse
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-center">
        <p className="w-full">
          ¿Ya tienes cuenta?
          <Link href={ROUTES.PUBLIC.LOGIN} className="text-blue-600 hover:underline ml-2">
            Inicia sesión
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
