"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
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
import { TbLock, TbUser, TbLoader, TbAlertTriangle, TbLogin, TbBrandGoogle } from "react-icons/tb";
import { ROUTES } from "@/routes/routePaths";
import { syncAuthState } from "@/utils/authSync";
import { UserProfile } from "@/types/user";

const loginSchema = z.object({
  username_or_email: z.string().min(1, { message: "El usuario o email es obligatorio" }),
  password: z.string().min(1, { message: "La contraseña es obligatoria" }),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

const isSafeInternalPath = (path: string | null): path is string => {
  if (!path) return false;
  return path.startsWith("/") && !path.startsWith("//");
};

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromRoute = searchParams.get("from");
  const safeFromRoute = isSafeInternalPath(fromRoute) ? fromRoute : null;
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const { login, loginWithGoogle, error: authError, loading } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    syncAuthState();
  }, []);

  const redirectAfterAuth = (profile: UserProfile | null) => {
    if (!profile || redirecting) return;
    setRedirecting(true);

    if (!profile.is_profile_completed) {
      router.push(ROUTES.PUBLIC.PROFILE_COMPLETE);
      return;
    }

    if (safeFromRoute && safeFromRoute !== ROUTES.PUBLIC.LOGIN && safeFromRoute !== ROUTES.PUBLIC.ROOT_LOGIN) {
      router.push(safeFromRoute);
      return;
    }

    router.push(ROUTES.PROTECTED.DASHBOARD);
  };

  const onSubmit = async (data: LoginFormInputs) => {
    const profile = await login(data.username_or_email, data.password);
    syncAuthState();
    redirectAfterAuth(profile);
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential || googleLoading) {
      setGoogleError("No se pudo obtener una credencial válida de Google.");
      return;
    }

    try {
      setGoogleLoading(true);
      setGoogleError(null);
      const profileType = localStorage.getItem("selectedProfileType") || "patient";
      const profile = await loginWithGoogle(credentialResponse.credential, profileType);
      syncAuthState();
      redirectAfterAuth(profile);
    } finally {
      setGoogleLoading(false);
    }
  };

  const googleUnavailable = useMemo(
    () => !googleClientId || googleClientId.trim().length === 0,
    [googleClientId]
  );

  return (
    <Card className="card-elevated w-full max-w-md mx-auto p-4 sm:p-6">
      <CardHeader>
        <CardTitle className="text-center text-2xl">
          <Image src="/assets/img/logo.png" alt="Logo" width={96} height={96} className="mx-auto mb-3" />
          Iniciar sesión
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(authError || googleError) && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="flex items-center gap-2">
              <TbAlertTriangle className="h-5 w-5" />
              <span>{authError || googleError}</span>
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-4">
          {googleUnavailable ? (
            <Button type="button" className="w-full" variant="secondary" disabled>
              <TbBrandGoogle className="h-5 w-5" />
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
                  text="signin_with"
                  shape="rectangular"
                  size="large"
                  locale="es"
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
            <Label className="flex items-center gap-2">
              <TbUser className="h-5 w-5 text-gray-500" />
              Usuario o Email
            </Label>
            <Input type="text" {...register("username_or_email")} />
            {errors.username_or_email && (
              <p className="text-red-500 text-sm mt-1">{errors.username_or_email.message}</p>
            )}
          </div>
          <div className="relative">
            <Label className="flex items-center gap-2">
              <TbLock className="h-5 w-5 text-gray-500" />
              Contraseña
            </Label>
            <Input type="password" {...register("password")} />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
            <Link
              href={`${ROUTES.PUBLIC.RECOVER_PASSWORD}?fromLogin=true`}
              className="absolute right-0 top-0 text-sm text-blue-600 hover:underline mt-1"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Button type="submit" disabled={loading || googleLoading} className="w-full">
            {loading ? (
              <span className="flex items-center justify-center">
                <TbLoader className="animate-spin h-5 w-5 mr-2" />
                Cargando...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <TbLogin className="h-5 w-5 mr-2" />
                Ingresar
              </span>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-center">
        <p className="w-full">
          ¿No tienes cuenta?
          <Link href={ROUTES.PUBLIC.PROFILE_TYPE} className="text-blue-600 hover:underline ml-2">
            Regístrate
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
