import { redirect } from 'next/navigation';

/** Equipment moved to a tab on the profile (2026-10-30); old links and notifications land there. */
export default async function OldEquipmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/account/equipment`);
}
