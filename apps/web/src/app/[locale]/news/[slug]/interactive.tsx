'use client';
import { useActionState, useEffect, useOptimistic, useRef, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { Button, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { addComment, deleteComment, toggleLike } from '../actions';

export function LikeButton(props: {
  newsId: string;
  slug: string;
  liked: boolean;
  count: number;
  canLike: boolean;
}) {
  const t = useTranslations('news');
  const [state, setOptimistic] = useOptimistic({ liked: props.liked, count: props.count });
  const [pending, start] = useTransition();
  const label = t('likes', { count: state.count });
  if (!props.canLike) return <p className="text-sm text-muted">{label}</p>;
  return (
    <Button
      variant={state.liked ? 'primary' : 'secondary'}
      aria-pressed={state.liked}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const liked = !state.liked;
          setOptimistic({ liked, count: state.count + (liked ? 1 : -1) });
          await toggleLike(props.newsId, props.slug, liked);
        })
      }
    >
      <span aria-hidden>{state.liked ? '♥' : '♡'}</span> {label}
    </Button>
  );
}

export function CommentForm({ newsId, slug }: { newsId: string; slug: string }) {
  const t = useTranslations('news');
  const [state, action] = useActionState(addComment, initialState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="space-y-3">
      <input type="hidden" name="news_id" value={newsId} />
      <input type="hidden" name="slug" value={slug} />
      <label htmlFor="comment" className="sr-only">
        {t('commentPlaceholder')}
      </label>
      <Textarea
        id="comment"
        name="body"
        required
        maxLength={2000}
        placeholder={t('commentPlaceholder')}
      />
      <p className="text-xs text-muted">{t('commentRules')}</p>
      <FormMessage state={state} />
      <SubmitButton>{t('commentSend')}</SubmitButton>
    </form>
  );
}

export function DeleteCommentButton({ id, slug }: { id: string; slug: string }) {
  const t = useTranslations('common');
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-muted hover:text-danger hover:underline"
      onClick={() => start(() => deleteComment(id, slug))}
    >
      {t('delete')}
    </button>
  );
}
