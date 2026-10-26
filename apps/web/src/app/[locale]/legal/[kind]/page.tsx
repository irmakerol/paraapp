import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { LEGAL_DOCUMENT_KINDS, type LegalDocumentKind } from '@paraapp/core';
import { getLatestLegalDocument } from '@/lib/legal';
import { Markdown } from '@/components/markdown';
import { Card, PageTitle } from '@/components/ui';

function isKind(kind: string): kind is LegalDocumentKind {
  return (LEGAL_DOCUMENT_KINDS as readonly string[]).includes(kind);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; kind: string }>;
}): Promise<Metadata> {
  const { locale, kind } = await params;
  if (!isKind(kind)) return {};
  const doc = await getLatestLegalDocument(kind, locale);
  return { title: doc?.title };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; kind: string }>;
}) {
  const { locale, kind } = await params;
  setRequestLocale(locale);
  if (!isKind(kind)) notFound();
  const doc = await getLatestLegalDocument(kind, locale);
  const t = await getTranslations('legal');
  const format = await getFormatter();
  if (!doc) return <PageTitle>{t('notFound')}</PageTitle>;
  return (
    <article className="mx-auto max-w-3xl">
      <PageTitle
        lead={`v${doc.version}${doc.published_at ? ` · ${format.dateTime(new Date(doc.published_at), { dateStyle: 'long' })}` : ''}`}
      >
        {doc.title}
      </PageTitle>
      <Card>
        <Markdown>{doc.body_md}</Markdown>
      </Card>
    </article>
  );
}
