import type { FullProgram } from "@/lib/queries";

export type BuilderProgram = FullProgram;
export type BuilderMesocycle = FullProgram["mesocycles"][number];
export type BuilderMicrocycle = BuilderMesocycle["microcycles"][number];
export type BuilderSession = BuilderMicrocycle["sessions"][number];
export type BuilderBlock = BuilderSession["blocks"][number];
export type BuilderPrescription = BuilderBlock["items"][number];
export type BlockTypeOption = { id: string; name: string; key: string };
