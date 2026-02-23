"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import API from "@/services/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/routes/routePaths";
import {
  TbActivityHeartbeat,
  TbArrowRight,
  TbCalendarEvent,
  TbChecklist,
  TbFileText,
  TbMessageCircle,
  TbPill,
  TbRefresh,
  TbReportMedical,
} from "react-icons/tb";

type HistoryEntry = {
  id: string;
  created_at?: string;
  notes?: string | null;
  triaje_level?: string | null;
  medical_context?: string | null;
};

type HistoryResponse = {
  count?: number;
  results?: HistoryEntry[];
};

const relativeTimeEs = (isoDate?: string) => {
  if (!isoDate) return "Sin actividad reciente";
  const now = new Date().getTime();
  const then = new Date(isoDate).getTime();
  const delta = Math.max(0, now - then);
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "Hace unos segundos";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days} d`;
  const months = Math.floor(days / 30);
  return `Hace ${months} mes${months > 1 ? "es" : ""}`;
};

const triageClass = (level?: string | null) => {
  const value = (level || "").toLowerCase();
  if (value.includes("urgent") || value.includes("urgente")) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (value.includes("moderad")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
};

const entryTitle = (entry: HistoryEntry) => {
  const fromNotes = entry.notes?.trim();
  if (fromNotes) return fromNotes;
  const fromContext = entry.medical_context?.trim();
  if (fromContext) return fromContext;
  return "Consulta de triaje";
};

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyCount, setHistoryCount] = useState(0);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (user?.tipo !== "patient") {
        setHistory([]);
        setHistoryCount(0);
        return;
      }

      const [patientRes, historyRes] = await Promise.all([
        API.get("patients/me/"),
        API.get("patients/me/history/?page_size=6"),
      ]);

      const historyData: HistoryResponse | HistoryEntry[] = historyRes.data;
      const entries = Array.isArray(historyData)
        ? historyData
        : Array.isArray(historyData.results)
          ? historyData.results
          : [];

      setHistory(entries);
      setHistoryCount(
        Array.isArray(historyData) ? historyData.length : Number(historyData.count ?? entries.length)
      );

      if (!patientRes.data) {
        setError("No se pudieron cargar tus datos del panel.");
      }
    } catch {
      setError("Error al cargar el dashboard. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [user?.tipo]);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [loadDashboard, user]);

  const latestEntry = useMemo(() => history[0], [history]);
  const isEmpty = historyCount === 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-r from-blue-800 via-blue-700 to-blue-600 text-white p-6 md:p-8">
          <p className="uppercase tracking-[0.1em] text-blue-200 text-xs md:text-sm font-semibold">Dashboard</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-1">Cargando...</h2>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card className="rounded-2xl border border-red-200 bg-red-50">
          <CardContent className="py-4 text-red-700">{error}</CardContent>
        </Card>
        <Button onClick={loadDashboard}>
          <TbRefresh className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl overflow-hidden bg-gradient-to-r from-blue-800 via-blue-700 to-blue-600 text-white p-6 md:p-8 shadow-lg relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_30%)]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="uppercase tracking-[0.1em] text-blue-200 text-xs md:text-sm font-semibold">Dashboard</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-1">
              Bienvenido, <span className="text-blue-200">{user?.first_name || "Usuario"}</span>
            </h2>
            <p className="mt-3 text-blue-100 max-w-xl">
              {isEmpty
                ? "Empieza tu primer triaje para generar recomendaciones y métricas en tu panel."
                : "Tu actividad reciente de triaje se actualiza automáticamente según tu uso."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="bg-white text-blue-700 hover:bg-blue-50" onClick={() => router.push(ROUTES.PROTECTED.CHAT)}>
              <TbMessageCircle className="h-4 w-4 mr-2" />
              {isEmpty ? "Iniciar primer triaje" : "Iniciar triaje"}
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
              <p className="text-3xl font-bold">{historyCount}</p>
              <p className="text-sm text-muted-foreground">Triajes realizados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated rounded-2xl">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <TbChecklist className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{latestEntry?.triaje_level || "Sin clasificación"}</p>
              <p className="text-sm text-muted-foreground">Último nivel de triaje</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated rounded-2xl">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <TbCalendarEvent className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{relativeTimeEs(latestEntry?.created_at)}</p>
              <p className="text-sm text-muted-foreground">Última actividad</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Hablar con Hipo", icon: <TbMessageCircle className="h-5 w-5" />, action: () => router.push(ROUTES.PROTECTED.CHAT) },
          { label: "Mi historial", icon: <TbFileText className="h-5 w-5" />, action: () => router.push(ROUTES.PROTECTED.MEDICAL_DATA) },
          { label: "Medicamentos", icon: <TbPill className="h-5 w-5" />, action: () => router.push(ROUTES.PROTECTED.MEDICAL_DATA) },
          { label: "Próxima revisión", icon: <TbCalendarEvent className="h-5 w-5" />, action: () => router.push(ROUTES.PROTECTED.MEDICAL_DATA) },
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
              <Button variant="ghost" className="text-blue-600" onClick={() => router.push(ROUTES.PROTECTED.MEDICAL_DATA)}>
                Ver todos
                <TbArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            {history.length === 0 ? (
              <div className="rounded-xl border border-border/60 p-5 bg-background/80">
                <p className="font-medium">Aún no tienes triajes registrados.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cuando completes tu primer triaje, aquí aparecerá tu historial real.
                </p>
                <Button className="mt-4" onClick={() => router.push(ROUTES.PROTECTED.CHAT)}>
                  Iniciar primer triaje
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/60 p-4 bg-background/80 flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entryTitle(item)}</p>
                      <p className="text-sm text-muted-foreground">{relativeTimeEs(item.created_at)}</p>
                    </div>
                    <span className={`text-xs font-semibold rounded-full px-3 py-1 border ${triageClass(item.triaje_level)}`}>
                      {item.triaje_level || "Sin clasificación"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated rounded-2xl">
          <CardContent className="pt-5">
            <h3 className="text-2xl font-semibold tracking-tight mb-4">Estado del panel</h3>
            <div className="space-y-3">
              <div className="rounded-xl border border-border/60 p-4 bg-background/80">
                <p className="font-semibold text-blue-700">Datos dinámicos activos</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Las métricas de este panel se actualizan según tus sesiones y tu historial médico real.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 p-4 bg-background/80">
                <p className="font-semibold text-blue-700">Sin datos ficticios</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Si aún no has usado la app, verás estado vacío y un acceso directo para iniciar tu primer triaje.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
