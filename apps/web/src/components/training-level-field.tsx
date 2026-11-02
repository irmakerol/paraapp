'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trainingLevelOptions } from '@paraapp/core';
import { Field, Select } from '@/components/ui';

/**
 * "Training for": the level a student pilot is working towards. Only levels above the level
 * chosen in the pilot level select are offered; the database enforces the same rule.
 */
export function TrainingLevelField({
  level,
  defaultValue,
  error,
}: {
  /** The current value of the pilot level select. */
  level: string;
  defaultValue: string;
  error?: string;
}) {
  const p = useTranslations('account.profile');
  const [chosen, setChosen] = useState(defaultValue);
  const options = trainingLevelOptions(level || null);
  // A target that is no longer above the level is dropped (the select shows "none").
  const value = (options as string[]).includes(chosen) ? chosen : '';
  return (
    <Field
      id="training_level"
      label={p('trainingLevel')}
      help={options.length ? p('trainingLevelHelp') : p('trainingLevelTop')}
      error={error}
    >
      <Select
        id="training_level"
        name="training_level"
        value={value}
        onChange={(e) => setChosen(e.target.value)}
        disabled={!options.length}
      >
        <option value="">{p('levelNone')}</option>
        {options.map((l) => (
          <option key={l} value={l}>
            {p(`levels.${l}` as 'levels.p2')}
          </option>
        ))}
      </Select>
    </Field>
  );
}
