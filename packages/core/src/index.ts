import { z } from "zod";

/**
 * Minimal production-graph shapes — enough to type fixture data for the
 * FRAME prototype shell. Deliberately shallow: full domain modeling
 * (breakdown elements, scheduling constraints, budget lines, rights,
 * documents) belongs to the feature-implementation phase, not this
 * foundation pass. See Constitution §91 and the build brief §0.
 */

export const productionPhaseSchema = z.enum(["Development", "Prep", "Production", "Post", "Wrap"]);
export type ProductionPhase = z.infer<typeof productionPhaseSchema>;

export const sceneStatusSchema = z.enum([
  "Draft",
  "Scheduled",
  "Shot",
  "Omitted",
  "Pickup",
  "Reshoot",
]);
export type SceneStatus = z.infer<typeof sceneStatusSchema>;

export const sceneSchema = z.object({
  id: z.string(),
  number: z.string(),
  intExt: z.enum(["INT", "EXT"]),
  setName: z.string(),
  dayNight: z.enum(["DAY", "NIGHT"]),
  synopsis: z.string(),
  pageCount: z.string(),
  status: sceneStatusSchema,
  shootDayId: z.string().nullable(),
  castIds: z.array(z.string()),
  locationId: z.string(),
});
export type Scene = z.infer<typeof sceneSchema>;

export const productionSchema = z.object({
  id: z.string(),
  name: z.string(),
  phase: productionPhaseSchema,
});
export type Production = z.infer<typeof productionSchema>;
