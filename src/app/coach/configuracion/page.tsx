import type { Metadata } from "next";
import { PageHeader } from "@/components/app-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCoach } from "@/lib/auth";
import { parseThresholds } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { BlockTypesForm, OrgNameForm, ThresholdsForm } from "./settings-forms";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const coach = await requireCoach();
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: coach.orgId },
    include: { blockTypes: { orderBy: { order: "asc" }, select: { id: true, name: true, archived: true } } },
  });

  return (
    <div className="max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader title="Configuración" />
      <Card>
        <CardHeader>
          <CardTitle>Centro o equipo</CardTitle>
        </CardHeader>
        <CardContent>
          <OrgNameForm name={org.name} canEdit={coach.role === "OWNER"} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Umbrales de regeneración</CardTitle>
          <CardDescription>
            El check-in suma seis ítems de 1 a 7 (total 6 a 42, más bajo es mejor). Cada tramo define el mensaje que ve el atleta antes de entrenar. Los tramos
            regular y deficiente generan una alerta en tu tablero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThresholdsForm initial={parseThresholds(org.wellnessThresholds)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tipos de bloque</CardTitle>
          <CardDescription>
            Aparecen al agregar bloques en el constructor. Los días nuevos se crean con Construcción de movimiento, Calentamiento, Pliometría, Primario,
            Secundario y Variabilidad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BlockTypesForm types={org.blockTypes} />
        </CardContent>
      </Card>
    </div>
  );
}
