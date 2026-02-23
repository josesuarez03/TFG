"use client";

import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";
import { TbBell, TbHelpCircle } from "react-icons/tb";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Buenos días",
  "/chat": "Chat con Hipo",
  "/profile": "Tu perfil",
  "/medical-data": "Datos médicos",
};

export default function Header() {
  const { user } = useAuth();
  const pathname = usePathname() || "";
  const pageTitle = PAGE_TITLES[pathname] || "Medicheck";
  const name = user?.first_name || "Usuario";

  return (
    <header className="h-14 border-b border-border/70 bg-card/95 backdrop-blur-md px-4 md:px-6 flex items-center justify-between">
      <h1 className="text-lg md:text-xl font-semibold tracking-tight">
        {pageTitle}, <span className="text-primary">{name}</span>
      </h1>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Notificaciones">
          <TbBell className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" aria-label="Ayuda">
          <TbHelpCircle className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
