'use client';
import { useEffect } from 'react';
import { markClubMessageRead } from '../../actions';

/** Marks the message read once it has been shown (not during render). */
export function MarkRead({ id }: { id: string }) {
  useEffect(() => {
    void markClubMessageRead(id);
  }, [id]);
  return null;
}
