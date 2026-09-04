import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { resolvePhotoUrls } from "@/lib/photo-storage";
import { generateQrDataUrl } from "@/lib/badge";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { SecurityClass } from "../../constants";
import { CredentialBadge } from "../../credential-badge";

export default async function CredentialBadgePage({ params }: { params: Promise<{ credentialId: string }> }) {
  const { credentialId } = await params;
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);

  const data = await runAsUser(user.id, async (db) => {
    const [credential] = await db
      .select()
      .from(schema.accessCredentials)
      .where(and(eq(schema.accessCredentials.id, credentialId), eq(schema.accessCredentials.productionId, production.id)))
      .limit(1);
    if (!credential) return null;

    const [identity] = await db
      .select()
      .from(schema.accessIdentities)
      .where(and(eq(schema.accessIdentities.id, credential.identityId), eq(schema.accessIdentities.productionId, production.id)))
      .limit(1);
    if (!identity) return null;

    return { credential, identity };
  });

  if (!data) notFound();
  const { credential, identity } = data;

  const castMember = identity.castMemberId ? snapshot.castMembers.find((c) => c.id === identity.castMemberId) : undefined;
  const character = castMember ? snapshot.characters.find((c) => c.id === castMember.characterId) : undefined;
  const crewMember = identity.crewMemberId ? snapshot.crewMembers.find((c) => c.id === identity.crewMemberId) : undefined;

  const name = castMember?.actorName ?? crewMember?.name ?? identity.displayName ?? "Unnamed";
  const subtitle = castMember ? (character?.name ?? null) : crewMember ? [crewMember.role, crewMember.department].filter(Boolean).join(" · ") : identity.company;
  const photoPath = castMember?.photoPath ?? crewMember?.photoPath ?? identity.photoPath;

  const [photoUrls, qrDataUrl] = await Promise.all([
    resolvePhotoUrls([photoPath, snapshot.production.logoPath]),
    generateQrDataUrl(credential.publicReference),
  ]);

  return (
    <CredentialBadge
      productionName={snapshot.production.name}
      brandColor={snapshot.production.brandColor}
      logoUrl={snapshot.production.logoPath ? (photoUrls[snapshot.production.logoPath] ?? null) : null}
      photoUrl={photoPath ? (photoUrls[photoPath] ?? null) : null}
      name={name}
      subtitle={subtitle}
      securityClass={credential.credentialClass as SecurityClass}
      credentialNumber={credential.credentialNumber}
      validFrom={credential.validFrom}
      validUntil={credential.validUntil}
      qrDataUrl={qrDataUrl}
    />
  );
}
