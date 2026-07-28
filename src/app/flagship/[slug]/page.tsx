import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFlagshipConfig, listFlagshipSlugs } from '@/lib/flagship/config';
import FlagshipExperienceClient from './FlagshipExperienceClient';

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listFlagshipSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cfg = getFlagshipConfig(slug);
  if (!cfg) return { title: 'Flagship' };
  const title = cfg.brandLabel?.en || cfg.slug;
  return {
    title: `${title} · SCC Shop`,
    description: 'Flagship product experience',
    robots: { index: true, follow: true },
  };
}

export default async function FlagshipPage({ params }: Props) {
  const { slug } = await params;
  const cfg = getFlagshipConfig(slug);
  if (!cfg) notFound();

  return <FlagshipExperienceClient slug={slug} />;
}
