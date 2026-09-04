import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { Shell } from "@/components/shell";
import { runAsUser, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@filmset/ui";
import type { CheckpointRow } from "./checkpoints-section";
import { CheckpointsSection } from "./checkpoints-section";
import type { CredentialRow } from "./credentials-section";
import { CredentialsSection } from "./credentials-section";
import type { DeviceRow } from "./devices-section";
import { DevicesSection } from "./devices-section";
import type { IdentityRow, PersonOption } from "./identities-section";
import { IdentitiesSection } from "./identities-section";
import type { ResourceRow } from "./resources-section";
import { ResourcesSection } from "./resources-section";

export default async function SecurityAccessPage() {
  const { user, production, role } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  const canManage = role === "Producer";

  const { identities, credentials, resources, checkpoints, devices } = await runAsUser(user.id, async (db) => {
    const [identityRows, credentialRows, resourceRows, checkpointRows, deviceRows] = await Promise.all([
      db.select().from(schema.accessIdentities).where(eq(schema.accessIdentities.productionId, production.id)).orderBy(schema.accessIdentities.createdAt),
      db.select().from(schema.accessCredentials).where(eq(schema.accessCredentials.productionId, production.id)).orderBy(schema.accessCredentials.createdAt),
      db.select().from(schema.accessResources).where(eq(schema.accessResources.productionId, production.id)).orderBy(schema.accessResources.name),
      db.select().from(schema.accessCheckpoints).where(eq(schema.accessCheckpoints.productionId, production.id)).orderBy(schema.accessCheckpoints.name),
      db.select().from(schema.accessDevices).where(eq(schema.accessDevices.productionId, production.id)).orderBy(schema.accessDevices.name),
    ]);
    return {
      identities: identityRows as unknown as IdentityRow[],
      credentials: credentialRows as unknown as CredentialRow[],
      resources: resourceRows as unknown as ResourceRow[],
      checkpoints: checkpointRows as unknown as CheckpointRow[],
      devices: deviceRows as unknown as DeviceRow[],
    };
  });

  const castOptions: PersonOption[] = snapshot.castMembers.map((c) => ({ id: c.id, label: c.actorName }));
  const crewOptions: PersonOption[] = snapshot.crewMembers.map((c) => ({ id: c.id, label: c.name }));
  const locationOptions: PersonOption[] = snapshot.locations.map((l) => ({ id: l.id, label: l.name }));
  const resourceOptions: PersonOption[] = resources.map((r) => ({ id: r.id, label: r.name }));
  const checkpointOptions: PersonOption[] = checkpoints.map((c) => ({ id: c.id, label: c.name }));

  const castById = new Map(snapshot.castMembers.map((c) => [c.id, c.actorName]));
  const crewById = new Map(snapshot.crewMembers.map((c) => [c.id, c.name]));
  const identityOptions: PersonOption[] = identities.map((i) => ({
    id: i.id,
    label:
      i.personCategory === "CAST"
        ? (castById.get(i.castMemberId ?? "") ?? "Unknown cast member")
        : i.personCategory === "CREW"
          ? (crewById.get(i.crewMemberId ?? "") ?? "Unknown crew member")
          : (i.displayName ?? "Unnamed"),
  }));

  return (
    <Shell production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <div className="flex flex-col gap-[var(--fs-space-4)]">
          <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Security & Access</h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)]">
            Identities, credentials, and the physical spaces and checkpoints this production controls access to.
            {!canManage && " You have view access — only a Producer can add or change entries."}
          </p>
        </div>

        <Tabs defaultValue="identities">
          <TabsList>
            <TabsTrigger value="identities">Identities</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="checkpoints">Checkpoints</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
          </TabsList>
          <TabsContent value="identities" className="pt-[var(--fs-space-16)]">
            <IdentitiesSection productionId={production.id} identities={identities} castOptions={castOptions} crewOptions={crewOptions} canManage={canManage} />
          </TabsContent>
          <TabsContent value="credentials" className="pt-[var(--fs-space-16)]">
            <CredentialsSection productionId={production.id} credentials={credentials} identityOptions={identityOptions} canManage={canManage} />
          </TabsContent>
          <TabsContent value="resources" className="pt-[var(--fs-space-16)]">
            <ResourcesSection productionId={production.id} resources={resources} locationOptions={locationOptions} canManage={canManage} />
          </TabsContent>
          <TabsContent value="checkpoints" className="pt-[var(--fs-space-16)]">
            <CheckpointsSection productionId={production.id} checkpoints={checkpoints} resourceOptions={resourceOptions} canManage={canManage} />
          </TabsContent>
          <TabsContent value="devices" className="pt-[var(--fs-space-16)]">
            <DevicesSection productionId={production.id} devices={devices} checkpointOptions={checkpointOptions} canManage={canManage} />
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  );
}
