"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "./ui/button";
import {
  TbHome,
  TbReportMedical,
  TbLogout,
  TbMessageCircle,
  TbChevronLeft,
  TbChevronRight,
  TbStethoscope,
  TbUserPlus,
  TbClipboardList,
  TbSettings,
  TbActivityHeartbeat,
  TbFileAnalytics,
} from "react-icons/tb";
import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";
import { ROUTES, NAVIGATION_ITEMS } from "@/routes/routePaths";

const iconMap: Record<string, React.ReactNode> = {
  HomeIcon: <TbHome />,
  ChatBubbleOvalLeftIcon: <TbMessageCircle />,
  ClipboardDocumentListIcon: <TbReportMedical />,
  UserGroupIcon: <TbUserPlus />,
  DocumentChartBarIcon: <TbClipboardList />,
  StethoscopeIcon: <TbStethoscope />,
};

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const { user, logout, isAuthenticated } = useAuth();
  const pathname = usePathname();

  const initials = useMemo(() => {
    const first = user?.first_name?.[0] || "";
    const last = user?.last_name?.[0] || "";
    return `${first}${last}`.toUpperCase() || "US";
  }, [user]);

  if (!isAuthenticated) return null;

  const isDoctor = user?.tipo === "doctor";

  const navItemClass = (active: boolean) =>
    `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      active
        ? "bg-blue-700 dark:bg-[#2E5CE6] text-white shadow-md before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-blue-300 dark:before:bg-[#9AB0FF]"
        : "text-white/75 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <aside
      className={`h-screen shrink-0 bg-blue-800 dark:bg-[#08142E] text-white border-r border-white/10 dark:border-[#243864]/80 transition-all duration-300 ${
        isExpanded ? "w-60" : "w-[74px]"
      }`}
    >
      <div className="h-full flex flex-col">
        <div className="px-3 py-4 border-b border-white/10 dark:border-[#243864]/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow">
                <Image src="/assets/img/icon192.png" alt="Medicheck" fill className="object-cover" sizes="40px" />
              </div>
              {isExpanded && <span className="font-bold tracking-tight text-2xl leading-none">medicheck</span>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="text-white hover:bg-white/10"
              aria-label="Contraer menú"
            >
              {isExpanded ? <TbChevronLeft className="h-4 w-4" /> : <TbChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="px-3 py-3">
          <Link
            href={ROUTES.PROTECTED.PROFILE}
            className="flex items-center gap-3 rounded-xl border border-white/20 dark:border-[#2A3F6C] bg-white/10 dark:bg-white/5 p-3 hover:bg-white/15 dark:hover:bg-white/10 transition"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-300 to-blue-500 text-white text-sm font-semibold flex items-center justify-center">
              {initials}
            </div>
            {isExpanded && (
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{`${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Usuario"}</p>
                <p className="text-xs text-blue-100 dark:text-[#B8CBFF] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-300 dark:bg-emerald-300" />
                  {isDoctor ? "Médico · Activo" : "Paciente · Activo"}
                </p>
              </div>
            )}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {isExpanded && <p className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-[0.12em] text-white/40 dark:text-[#7E92C5]">Principal</p>}
          <div className="space-y-1">
            {NAVIGATION_ITEMS.main.map((item) => (
              <Link key={item.path} href={item.path} className={navItemClass(pathname === item.path)}>
                <span className="text-lg">{iconMap[item.icon] || <TbHome />}</span>
                {isExpanded && <span>{item.name === "Chat" ? "Chat · Hipo" : item.name}</span>}
              </Link>
            ))}
          </div>

          {isExpanded && <p className="px-2 pt-5 pb-1 text-[11px] uppercase tracking-[0.12em] text-white/40 dark:text-[#7E92C5]">Historial</p>}
          <div className="space-y-1">
            <button type="button" className={navItemClass(false) + " w-full text-left"}>
              <span className="text-lg">
                <TbActivityHeartbeat />
              </span>
              {isExpanded && <span>Mis triajes</span>}
            </button>
            <button type="button" className={navItemClass(false) + " w-full text-left"}>
              <span className="text-lg">
                <TbFileAnalytics />
              </span>
              {isExpanded && <span>Informes</span>}
            </button>
          </div>

          {isDoctor && (
            <>
              {isExpanded && (
                <p className="px-2 pt-5 pb-1 text-[11px] uppercase tracking-[0.12em] text-white/40 dark:text-[#7E92C5]">Doctor</p>
              )}
              <div className="space-y-1">
                {NAVIGATION_ITEMS.doctor.map((item) => (
                  <Link key={item.path} href={item.path} className={navItemClass(pathname === item.path)}>
                    <span className="text-lg">{iconMap[item.icon] || <TbHome />}</span>
                    {isExpanded && <span>{item.name}</span>}
                  </Link>
                ))}
              </div>
            </>
          )}
        </nav>

        <div className="px-2 py-3 border-t border-white/10 dark:border-[#243864]/80 space-y-1">
          <button type="button" className={navItemClass(false) + " w-full text-left"}>
            <span className="text-lg">
              <TbSettings />
            </span>
            {isExpanded && <span>Configuración</span>}
          </button>
          <button
            type="button"
            onClick={logout}
            className="group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-blue-100 hover:bg-red-500/15 hover:text-red-100 transition"
          >
            <span className="text-lg">
              <TbLogout />
            </span>
            {isExpanded && <span>Cerrar sesión</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
