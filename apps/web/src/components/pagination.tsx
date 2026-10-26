import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { buttonClass } from './ui';

/** Previous/next links that keep the other search params. */
export async function Pagination({
  pathname,
  params,
  page,
  hasNext,
}: {
  pathname: string;
  params: Record<string, string | undefined>;
  page: number;
  hasNext: boolean;
}) {
  const t = await getTranslations('common');
  if (page <= 1 && !hasNext) return null;
  const href = (p: number) => {
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) if (v) query[k] = v;
    if (p > 1) query.page = String(p);
    else delete query.page;
    return { pathname, query };
  };
  return (
    <nav className="mt-8 flex justify-between" aria-label="pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClass('secondary')} rel="prev">
          {t('previous')}
        </Link>
      ) : (
        <span />
      )}
      {hasNext ? (
        <Link href={href(page + 1)} className={buttonClass('secondary')} rel="next">
          {t('next')}
        </Link>
      ) : null}
    </nav>
  );
}
