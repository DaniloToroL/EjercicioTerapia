"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WELLNESS_ITEMS } from "@/lib/constants";
import { formatDateShort } from "@/lib/dates";
import { formatNumber } from "@/lib/metrics";
import type { ProgressData } from "@/lib/queries";

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "oklch(0.6 0.12 200)", "oklch(0.5 0.05 60)", "oklch(0.7 0.15 330)"];

const LEVEL_FILL: Record<string, string> = {
  optimal: "oklch(0.72 0.17 150)",
  good: "oklch(0.75 0.12 230)",
  warning: "oklch(0.8 0.15 80)",
  bad: "oklch(0.65 0.2 25)",
};

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>;
}

export function ProgressCharts({ data }: { data: ProgressData }) {
  // Los levantamientos principales (mayor 1RM estimado) primero.
  const withLoad = data.exercises
    .filter((e) => e.points.some((p) => p.e1rm != null || p.maxKg > 0))
    .sort((a, b) => (b.best1RM ?? b.bestKg ?? 0) - (a.best1RM ?? a.bestKg ?? 0));
  const [exerciseId, setExerciseId] = useState(withLoad[0]?.id ?? "");
  const exercise = withLoad.find((e) => e.id === exerciseId);

  const e1rmConfig = {
    e1rm: { label: "1RM estimado (kg)", color: "var(--chart-1)" },
    maxKg: { label: "Carga máxima (kg)", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  const blockKeys = data.blockNames.map((name, i) => ({ key: `b${i}`, name }));
  const blockConfig = Object.fromEntries(blockKeys.map((b, i) => [b.key, { label: b.name, color: PALETTE[i % PALETTE.length] }])) satisfies ChartConfig;
  const blockRows = data.weeklyBlocks.map((row) => {
    const out: Record<string, number | string> = { week: formatDateShort(String(row.week)) };
    blockKeys.forEach((b) => (out[b.key] = row[b.name] ?? 0));
    return out;
  });

  const loadConfig = {
    load: { label: "Carga interna (RPE x min)", color: "var(--chart-3)" },
  } satisfies ChartConfig;
  const loadRows = data.weeks.map((w) => ({ week: formatDateShort(w.week), load: w.load, sessions: w.sessions }));

  const wellnessConfig = { total: { label: "Total regeneración", color: "var(--chart-1)" } } satisfies ChartConfig;
  const wellnessRows = data.wellness.map((w) => ({ ...w, label: formatDateShort(w.date) }));
  const bands = data.thresholds.map((t, i) => ({ y1: i === 0 ? 6 : data.thresholds[i - 1].max, y2: t.max, level: t.level }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Progreso por ejercicio</CardTitle>
            <CardDescription>1RM estimado con Epley ajustado por RPE, y carga máxima por sesión.</CardDescription>
          </div>
          {withLoad.length > 0 && (
            <Select value={exerciseId} onValueChange={setExerciseId}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {withLoad.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {exercise ? (
            <>
              <div className="mb-3 flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Mejor 1RM estimado </span>
                  <span className="font-semibold">{exercise.best1RM ? `${formatNumber(exercise.best1RM, 1)} kg` : "sin datos"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Carga máxima </span>
                  <span className="font-semibold">{exercise.bestKg ? `${formatNumber(exercise.bestKg, 1)} kg` : "sin datos"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sesiones </span>
                  <span className="font-semibold">{exercise.sessions}</span>
                </div>
              </div>
              <ChartContainer config={e1rmConfig} className="aspect-auto h-64 w-full">
                <LineChart data={exercise.points.map((p) => ({ ...p, label: formatDateShort(p.date) }))} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line isAnimationActive={false} dataKey="e1rm" type="monotone" stroke="var(--color-e1rm)" strokeWidth={2} dot connectNulls />
                  <Line isAnimationActive={false} dataKey="maxKg" type="monotone" stroke="var(--color-maxKg)" strokeWidth={2} strokeDasharray="4 4" dot />
                </LineChart>
              </ChartContainer>
            </>
          ) : (
            <Empty text="Aún no hay series registradas con carga." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tonelaje semanal por bloque</CardTitle>
          <CardDescription>Suma de repeticiones por kg de las series realizadas.</CardDescription>
        </CardHeader>
        <CardContent>
          {blockRows.length ? (
            <ChartContainer config={blockConfig} className="aspect-auto h-64 w-full">
              <BarChart data={blockRows}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {blockKeys.map((b) => (
                  <Bar isAnimationActive={false} key={b.key} dataKey={b.key} stackId="a" fill={`var(--color-${b.key})`} />
                ))}
              </BarChart>
            </ChartContainer>
          ) : (
            <Empty text="Sin datos todavía." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Carga interna semanal</CardTitle>
          <CardDescription>RPE de la sesión por minutos de duración (método de Foster).</CardDescription>
        </CardHeader>
        <CardContent>
          {loadRows.length ? (
            <ChartContainer config={loadConfig} className="aspect-auto h-64 w-full">
              <BarChart data={loadRows}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar isAnimationActive={false} dataKey="load" fill="var(--color-load)" radius={4} />
              </BarChart>
            </ChartContainer>
          ) : (
            <Empty text="Sin sesiones cerradas todavía." />
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Regeneración</CardTitle>
          <CardDescription>Total del check-in (6 a 42). Más bajo es mejor. Las franjas muestran los umbrales configurados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {wellnessRows.length ? (
            <>
              <ChartContainer config={wellnessConfig} className="aspect-auto h-56 w-full">
                <LineChart data={wellnessRows} margin={{ left: 0, right: 12 }}>
                  {bands.map((b) => (
                    <ReferenceArea key={b.level} y1={b.y1} y2={b.y2} fill={LEVEL_FILL[b.level]} fillOpacity={0.12} strokeOpacity={0} />
                  ))}
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={32} domain={[6, 42]} reversed />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line isAnimationActive={false} dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2} dot />
                </LineChart>
              </ChartContainer>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      {WELLNESS_ITEMS.map((i) => (
                        <TableHead key={i.key} className="text-center">
                          {i.label}
                        </TableHead>
                      ))}
                      <TableHead className="text-center">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...wellnessRows]
                      .reverse()
                      .slice(0, 10)
                      .map((w) => (
                        <TableRow key={w.date + w.total}>
                          <TableCell>{w.label}</TableCell>
                          {WELLNESS_ITEMS.map((i) => (
                            <TableCell key={i.key} className="text-center tabular-nums">
                              {w[i.key]}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-semibold tabular-nums">{w.total}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <Empty text="Sin check-ins todavía." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
