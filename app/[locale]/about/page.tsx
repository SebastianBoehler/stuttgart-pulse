import { notFound } from "next/navigation";
import { AboutPageContent } from "@/components/pages/about-page";
import { getDictionary, isLocale } from "@/lib/i18n";

export const dynamic = "force-static";

export default async function LocalizedAboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <AboutPageContent locale={locale} dictionary={getDictionary(locale)} />;
}
