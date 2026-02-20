"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TbActivityHeartbeat,
  TbArrowRight,
  TbCalendarEvent,
  TbChecklist,
  TbDroplet,
  TbFileText,
  TbMessageCircle,
  TbPill,
  TbReportMedical,
  TbSun,
  TbMoonStars,
  TbAlertTriangle,
} from "react-icons/tb";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/routes/routePaths";

const triageHistory = [
  { title: "Dolor de cabeza y fiebre", date: "Hace 2 días · 19:40", level: "Niv. 3 · Urgente", color: "bg-amber-500" },
  { title: "Tos seca y congestión nasal", date: "Hace 5 días · 11:20", level: "Niv. 4 · Leve", color: "bg-emerald-500" },
  { title: "Dolor muscular tras ejercicio", date: "Hace 12 días · 09:05", level: "Niv. 4 · Leve", color: "bg-emerald-500" },
  { title: "Mareo y náuseas leves", date: "Hace 18 días · 16:30", level: "Niv. 2 · Muy urgente", color: "bg-orange-500" },
];

const preventTips = [
  { icon: <TbDroplet className="h-5 w-5 text-blue-500" />, title: "Hidratación", body: "Bebe al menos 2 litros de agua diarios para apoyar tu sistema inmune." },
  { icon: <TbMoonStars className="h-5 w-5 text-violet-500" />, title: "Descanso", body: "Dormir 7-8h mejora tu capacidad de recuperación." },
  { icon: <TbAlertTriangle className="h-5 w-5 text-amber-500" />, title: "Recuerda", body: "Hipo orienta y clasifica. El diagnóstico definitivo siempre lo da un médico." },
];

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl overflow-hidden bg-gradient-to-r from-blue-800 via-blue-700 to-blue-600 text-white p-6 md:p-8 shadow-lg relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_30%)]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="uppercase tracking-[0.1em] text-blue-200 text-xs md:text-sm font-semibold">Viernes</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-1">
              Bienvenido, <span className="text-blue-200">{user?.first_name || "Usuario"}</span>
            </h2>
            <p className="mt-3 text-blue-100 max-w-xl">Tu asistente Hipo está listo para ayudarte con un nuevo triaje.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="bg-white text-blue-700 hover:bg-blue-50" onClick={() => router.push(ROUTES.PROTECTED.CHAT)}>
              <TbMessageCircle className="h-4 w-4 mr-2" />
              Iniciar triaje
            </Button>
            <Button variant="outline" className="border-white/35 text-white hover:bg-white/10" onClick={() => router.push(ROUTES.PROTECTED.MEDICAL_DATA)}>
              <TbReportMedical className="h-4 w-4 mr-2" />
              Ver datos
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-elevated rounded-2xl">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <TbActivityHeartbeat className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-bold">7</p>
              <p className="text-sm text-muted-foreground">Triajes realizados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated rounded-2xl">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TbChecklist className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-600">Verde</p>
              <p className="text-sm text-muted-foreground">Último nivel de triaje</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated rounded-2xl">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <TbCalendarEvent className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-bold">3d</p>
              <p className="text-sm text-muted-foreground">Próxima revisión</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Hablar con Hipo", icon: <TbMessageCircle className="h-5 w-5" />, action: () => router.push(ROUTES.PROTECTED.CHAT) },
          { label: "Mi historial", icon: <TbFileText className="h-5 w-5" />, action: () => router.push(ROUTES.PROTECTED.MEDICAL_DATA) },
          { label: "Medicamentos", icon: <TbPill className="h-5 w-5" />, action: () => router.push(ROUTES.PROTECTED.MEDICAL_DATA) },
          { label: "Próximas citas", icon: <TbCalendarEvent className="h-5 w-5" />, action: () => router.push(ROUTES.PROTECTED.MEDICAL_DATA) },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="card-elevated rounded-2xl bg-card p-5 text-left hover:shadow-md transition border border-border/70"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">{item.icon}</div>
            <p className="font-semibold mt-4">{item.label}</p>
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-4">
        <Card className="card-elevated rounded-2xl">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-semibold tracking-tight">Historial de triajes</h3>
              <Button variant="ghost" className="text-blue-600">
                Ver todos
                <TbArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="space-y-3">
              {triageHistory.map((item) => (
                <div key={item.title} className="rounded-xl border border-border/60 p-4 bg-background/80 flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.date}</p>
                  </div>
                  <span className="text-xs font-semibold rounded-full px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200">
                    {item.level}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated rounded-2xl">
          <CardContent className="pt-5">
            <h3 className="text-2xl font-semibold tracking-tight mb-4">Consejos preventivos</h3>
            <div className="space-y-3">
              {preventTips.map((tip) => (
                <div key={tip.title} className="rounded-xl border border-border/60 p-4 bg-background/80">
                  <p className="font-semibold flex items-center gap-2">
                    {tip.icon}
                    {tip.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">{tip.body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
