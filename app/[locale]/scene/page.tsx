import { notFound } from "next/navigation";
import { SceneShell } from "@/components/scene/scene-shell";
import { getDictionary, isLocale } from "@/lib/i18n";

export const dynamic = "force-static";

export default async function LocalizedScenePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <SceneShell locale={locale} dictionary={getDictionary(locale)} />;
}
