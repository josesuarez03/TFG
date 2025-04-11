import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BsPersonFill, BsHeartPulseFill } from "react-icons/bs";

export default function ProfileType() {
    const router = useRouter();
    const [selectedType, setSelectedType] = React.useState<string | null>(null);

    const handleSelect = (type: "patient" | "doctor") => {
        setSelectedType(type);
        localStorage.setItem('selectedProfileType', type);
    }

    const handleCreateAccount = () => {
        if (selectedType) {
            router.push({
                pathname: '/register',
                query: { type: selectedType }
            });
        }
    }

    return (
        <div className="container mx-auto max-w-3xl py-12 px-4">
            <div className="text-center mb-10">
                <Image
                    src="/logo.png"
                    alt="Logo"
                    width={120}
                    height={120}
                    className="mx-auto mb-4"
                />
                <h1 className="text-3xl font-bold mb-2">¿Cómo deseas usar nuestra plataforma?</h1>
                <p className="text-gray-500">Selecciona el tipo de perfil que deseas crear</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Tarjeta para Paciente */}
                <Card 
                    className={`p-6 border-2 cursor-pointer transition-all ${
                        selectedType === 'patient' 
                            ? 'border-blue-500 ring-2 ring-blue-200' 
                            : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleSelect('patient')}
                >
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-2 rounded-full bg-gray-100">
                            <BsPersonFill className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 ${
                            selectedType === 'patient' ? 'border-blue-500 bg-blue-500/20' : 'border-gray-300'
                        }`}>
                            {selectedType === 'patient' && (
                                <div className="w-3 h-3 bg-blue-500 rounded-full m-auto mt-1"></div>
                            )}
                        </div>
                    </div>
                    <h2 className="text-xl font-bold mb-1">Soy Paciente</h2>
                    <p className="text-gray-600 text-sm">
                        Crea un perfil como paciente para encontrar médicos, agendar citas y acceder a tu historial médico.
                    </p>
                </Card>

                {/* Tarjeta para Médico */}
                <Card 
                    className={`p-6 border-2 cursor-pointer transition-all ${
                        selectedType === 'doctor' 
                            ? 'border-blue-500 ring-2 ring-blue-200' 
                            : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleSelect('doctor')}
                >
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-2 rounded-full bg-gray-100">
                            <BsHeartPulseFill className="w-6 h-6 text-red-500" />
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 ${
                            selectedType === 'doctor' ? 'border-blue-500 bg-blue-500/20' : 'border-gray-300'
                        }`}>
                            {selectedType === 'doctor' && (
                                <div className="w-3 h-3 bg-blue-500 rounded-full m-auto mt-1"></div>
                            )}
                        </div>
                    </div>
                    <h2 className="text-xl font-bold mb-1">Soy Médico</h2>
                    <p className="text-gray-600 text-sm">
                        Crea un perfil como médico para gestionar tus pacientes, organizar tu agenda y brindar atención de calidad.
                    </p>
                </Card>
            </div>

            <div className="text-center">
                <Button 
                    onClick={handleCreateAccount}
                    disabled={!selectedType} 
                    className="w-full md:w-1/3 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-md font-medium mb-6"
                >
                    Crear Cuenta
                </Button>
                
                <p>
                    ¿Ya tienes una cuenta?{" "}
                    <Link href="/login" className="text-green-600 hover:underline font-medium">
                        Inicia sesión aquí
                    </Link>
                </p>
            </div>
        </div>
    );
}