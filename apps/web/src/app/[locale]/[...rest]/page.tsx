import { notFound } from 'next/navigation';

/** Any unknown path inside a locale renders the localised not-found page (with header and footer). */
export default function CatchAll() {
  notFound();
}
