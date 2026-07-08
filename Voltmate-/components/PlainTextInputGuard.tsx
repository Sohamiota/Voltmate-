'use client';

import { useEffect } from 'react';
import { installPlainTextInputGuard } from '@/lib/crmTextInput';

/** Global guard: blocks emojis / invalid chars in all text inputs and textareas. */
export default function PlainTextInputGuard() {
  useEffect(() => installPlainTextInputGuard(), []);
  return null;
}
