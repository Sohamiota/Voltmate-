import {
  optEnum,
  optStr,
  optDate,
  optIsoDateTime,
  optBool,
  collectErrors,
  DEFERRAL_BUCKETS,
  CONTACT_DISPOSITIONS,
} from './validate';

export type ParsedCrmDeferral = {
  deferral_bucket: string | null;
  deferral_notes: string | null;
  follow_up_after_date: string | null;
  earliest_purchase_intent_date: string | null;
  contact_disposition: string | null;
  callback_requested_at: string | null;
  customer_promised_callback: boolean;
};

/**
 * Validates optional CRM deferral + callback fields from JSON body.
 * Rules: if buying timeframe is set and not `unknown`, require follow_up_after_date OR callback_requested_at.
 * Same OR-rule when disposition is busy_will_call_back / requested_callback_later.
 */
export function parseCrmDeferralBody(body: Record<string, unknown>): {
  error: string | null;
  parsed: ParsedCrmDeferral | null;
} {
  const vDeferral = optEnum(body.deferral_bucket, DEFERRAL_BUCKETS);
  const vDeferNotes = optStr(body.deferral_notes, 2000);
  const vFollowUp = optDate(body.follow_up_after_date);
  const vEarliest = optDate(body.earliest_purchase_intent_date);
  const vDispo = optEnum(body.contact_disposition, CONTACT_DISPOSITIONS);
  const vCbAt = optIsoDateTime(body.callback_requested_at);
  const vPromised = optBool(body.customer_promised_callback);

  const fieldErr = collectErrors({
    deferral_bucket: vDeferral.error,
    deferral_notes: vDeferNotes.error,
    follow_up_after_date: vFollowUp.error,
    earliest_purchase_intent_date: vEarliest.error,
    contact_disposition: vDispo.error,
    callback_requested_at: vCbAt.error,
    customer_promised_callback: vPromised.error || null,
  });
  if (fieldErr) return { error: fieldErr, parsed: null };

  const deferralNeedsFollowUp =
    vDeferral.value != null && vDeferral.value !== 'unknown';

  const callbackDisposition =
    vDispo.value === 'busy_will_call_back' || vDispo.value === 'requested_callback_later';

  if (deferralNeedsFollowUp && !vFollowUp.value && !vCbAt.value) {
    return {
      error:
        'follow_up_after_date or callback_requested_at is required when buying timeframe is set (except unknown)',
      parsed: null,
    };
  }
  if (callbackDisposition && !vFollowUp.value && !vCbAt.value) {
    return {
      error:
        'follow_up_after_date or callback_requested_at is required when call outcome is busy / callback later',
      parsed: null,
    };
  }

  return {
    error: null,
    parsed: {
      deferral_bucket: vDeferral.value,
      deferral_notes: vDeferNotes.value,
      follow_up_after_date: vFollowUp.value,
      earliest_purchase_intent_date: vEarliest.value,
      contact_disposition: vDispo.value,
      callback_requested_at: vCbAt.value,
      customer_promised_callback: vPromised.value,
    },
  };
}
