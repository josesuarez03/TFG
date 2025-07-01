'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TbActivity, TbFileText, TbClock, TbClipboardCheck, TbAlertCircle, TbHistory,TbRefresh,TbPill,TbAlertTriangle} from "react-icons/tb";
import API from '@/services/api';
import { useApiError } from '@/hooks/useApiError';
import { ROUTES } from '@/routes/routePaths';
import { UserProfile } from '@/types/user';


export default function MedicalData() {
    const router = useRouter();
    const { user } = useAuth();
    const { handleApiError } = useApiError();
    const [loading, setLoading] = useState(true);
    const [patientData, setPatientData] = useState<UserProfile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch patient medical data
    const fetchPatientData = async () => {
        try {
            const response = await API.get('patients/me/');
            return response.data;
        } catch (error) {
            throw error;
        }
    };

    // Get patient data and handle loading/errors
    const getPatientData = React.useCallback(async (showRefreshing = false) => {
        try {
            if (showRefreshing) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            
            const data = await fetchPatientData();
            setPatientData(data);
            setError(null);
        } catch (err) {
            setError('Error al cargar tus datos médicos');
            handleApiError(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [handleApiError]);

    // Handle refresh button click
    const handleRefresh = () => {
        getPatientData(true);
    };

    // Initial data loading and authentication check
    useEffect(() => {
        if (!user) {
            router.push(ROUTES.PUBLIC.LOGIN);
            return;
        }
        
        if (user.tipo !== 'patient') {
            router.push(ROUTES.PROTECTED.DASHBOARD);
            return;
        }

        getPatientData();
    }, [user, router, handleApiError, getPatientData]); // Added getPatientData to dependency array

    // Loading skeleton state
    if (loading) {
        return (
            <div className="container mx-auto py-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold">Mis Datos Médicos</h1>
                        <p className="text-muted-foreground">
                            Revisa y actualiza tu información médica
                        </p>
                    </div>
                </div>
                
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-6 w-1/3" />
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-48" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <Skeleton className="h-6 w-40 mb-2" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                        <Separator />
                        <div>
                            <Skeleton className="h-6 w-32 mb-2" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                        <Separator />
                        <div>
                            <Skeleton className="h-6 w-36 mb-2" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="container mx-auto py-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold">Mis Datos Médicos</h1>
                        <p className="text-muted-foreground">
                            Revisa y actualiza tu información médica
                        </p>
                    </div>
                </div>
                
                <Alert variant="destructive" className="mb-4">
                    <TbAlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                
                <div className="flex justify-center mt-6">
                    <Button 
                        onClick={handleRefresh}
                        className="flex items-center gap-2"
                    >
                        <TbRefresh className="h-4 w-4" />
                        Intentar nuevamente
                    </Button>
                </div>
            </div>
        );
    }

    // If no data but no error (shouldn't normally happen)
    if (!patientData) return null;

    // Get color class based on triage level
    const getTriageColorClass = (level: string | null | undefined) => {
        if (!level) return 'bg-gray-100 text-gray-800 border-gray-200';
        
        switch (level.toLowerCase()) {
            case 'urgente':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'moderado':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            default:
                return 'bg-green-100 text-green-800 border-green-200';
        }
    };

    // Get color class based on pain scale
    const getPainScaleColorClass = (scale: number | null | undefined) => {
        if (scale === null || scale === undefined) return 'bg-gray-500';
        if (scale >= 7) return 'bg-red-500';
        if (scale >= 4) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Mis Datos Médicos</h1>
                    <p className="text-muted-foreground">
                        Revisa y actualiza tu información médica
                    </p>
                </div>
                <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2"
                >
                    <TbRefresh className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Actualizando...' : 'Actualizar'}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TbActivity className="h-5 w-5 text-primary" />
                        Estado Médico Actual
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                        {patientData.patient?.is_data_validate ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <TbClipboardCheck className="h-3 w-3 mr-1" />
                                Validado por médico
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                Pendiente de validación
                            </Badge>
                        )}
                        {patientData.patient?.triaje_level && (
                            <Badge
                                className={getTriageColorClass(patientData.patient.triaje_level)}
                            >
                                Triaje: {patientData.patient.triaje_level}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {patientData.patient?.pain_scale !== undefined && (
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Escala de dolor</p>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div
                                        className={`h-2.5 rounded-full ${getPainScaleColorClass(patientData.patient.pain_scale)}`}
                                        style={{ width: `${((patientData.patient.pain_scale || 0) / 10) * 100}%` }}
                                    ></div>
                                </div>
                                <span className="text-sm font-medium">{patientData.patient.pain_scale}/10</span>
                            </div>
                        </div>
                    )}

                    {patientData.patient?.data_validated_at && (
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Última validación</p>
                            <p className="flex items-center gap-1">
                                <TbClock className="h-3 w-3" />
                                {new Date(patientData.patient.data_validated_at).toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                                {" por Dr./Dra. Médico"}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TbFileText className="h-5 w-5 text-primary" />
                        Información Médica
                    </CardTitle>
                    <CardDescription>
                        Información sobre tu estado de salud actual
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                            <TbFileText className="h-4 w-4 text-muted-foreground" />
                            Contexto Médico
                        </h3>
                        <p className="text-muted-foreground">
                            {patientData.patient?.medical_context || 'No hay información disponible'}
                        </p>
                    </div>

                    <Separator />

                    <div>
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                            <TbAlertTriangle className="h-4 w-4 text-muted-foreground" />
                            Alergias
                        </h3>
                        <p className="text-muted-foreground">
                            {patientData.patient?.allergies || 'No se han registrado alergias'}
                        </p>
                    </div>

                    <Separator />

                    <div>
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                            <TbPill className="h-4 w-4 text-muted-foreground" />
                            Medicamentos
                        </h3>
                        <p className="text-muted-foreground">
                            {patientData.patient?.medications || 'No se han registrado medicamentos'}
                        </p>
                    </div>

                    <Separator />

                    <div>
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                            <TbHistory className="h-4 w-4 text-muted-foreground" />
                            Historial Médico
                        </h3>
                        <p className="text-muted-foreground">
                            {patientData.patient?.medical_history || 'No se ha registrado historial médico'}
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-center pt-2">
                    <Button
                        onClick={() => router.push(ROUTES.PROTECTED.MEDICAL_DATA + '/history')}
                        className="flex items-center gap-2"
                    >
                        <TbHistory className="h-4 w-4" />
                        Ver historial completo
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}