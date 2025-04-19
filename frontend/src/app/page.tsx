import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TbMessageCircle, TbReportMedical, TbUserPlus } from 'react-icons/tb';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth'; 
import { ROUTES } from '@/routes/routePaths';

export default function Home() {
    const router = useRouter();
    const { user } = useAuth(); // Obtener información del usuario

    const handleStartConsultation = () => {
        router.push(ROUTES.PROTECTED.CHAT); // Ruta para iniciar la consulta
    };

    const handleStartMedicalData = () => {
        router.push(ROUTES.PROTECTED.MEDICAL_DATA); // Ruta para ver los datos médicos
    };

    const handleViewPatients = () => {
        router.push(ROUTES.DOCTOR.PATIENTS); // Ruta para la vista de pacientes
    };

    const isDoctor = user?.tipo === 'doctor'; // Verificar si el usuario es doctor

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2 space-y-6">
            <Card className="w-full max-w-md mx-auto">
                <CardHeader>
                    <CardTitle>Asistente Médico Virtual</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Nuestro chatbot realiza un triaje inicial para identificar posibles diagnósticos basados en tus síntomas. La información extraída durante la conversación es posteriormente verificada por un médico profesional para un diagnóstico definitivo.</p>
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button 
                        variant="default" 
                        onClick={handleStartConsultation} 
                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <TbMessageCircle className="text-lg" />
                        <span>Iniciar triaje</span>
                    </Button>
                </CardFooter>
            </Card>

            <Card className="w-full max-w-md mx-auto">
                <CardHeader>
                    <CardTitle>Tus Datos Médicos</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Accede y gestiona toda tu información médica personal de forma segura. Consulta tu historial clínico, resultados de exámenes y próximas citas médicas en un solo lugar.</p>
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button 
                        variant="default" 
                        onClick={handleStartMedicalData} 
                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <TbReportMedical className="text-lg" />
                        <span>Ver mis datos</span>
                    </Button>
                </CardFooter>
            </Card>

            {isDoctor && ( // Mostrar esta carta solo si el usuario es doctor
                <Card className="w-full max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle>Tus Pacientes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Accede a la lista de tus pacientes y gestiona su información médica.</p>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button 
                            variant="default" 
                            onClick={handleViewPatients} 
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            <TbUserPlus className="text-lg" />
                            <span>Ver pacientes</span>
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}