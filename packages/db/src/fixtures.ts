import type { Production, Scene } from "@filmset/core";

/**
 * Structured fixture data — "THE BAND" — used to make the FRAME shell
 * prototype feel real without any business logic behind it (build brief §6).
 * Expand this fixture set when the five canonical screens are built; do not
 * grow business logic to populate it.
 */
export const theBandProduction: Production = {
  id: "prod_the-band",
  name: "THE BAND",
  phase: "Production",
};

export const theBandScenes: Scene[] = [
  {
    id: "scene_47",
    number: "47",
    intExt: "EXT",
    setName: "Paharganj Street",
    dayNight: "NIGHT",
    synopsis: "Abraham arrives looking for Aisha.",
    pageCount: "2 1/8",
    status: "Scheduled",
    shootDayId: "day_18",
    castIds: ["cast_abraham", "cast_aisha"],
    locationId: "loc_paharganj-street",
  },
];
