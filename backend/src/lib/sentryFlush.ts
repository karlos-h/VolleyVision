// Pure: no Sentry import. Lets netlify-functions/api.js skip `Sentry.flush`
// on the (vast majority of) invocations where nothing was queued.
//
// Only beforeSend (errors) is wrapped, not beforeSendTransaction: an unflushed
// sampled transaction is sent on a later invocation or dropped, which is fine;
// an error must always be flushed before Netlify freezes the instance.
let flushNeeded = false;

// Flags even when fn returns null: a dropped event still means Sentry did work.
export function wrapBeforeSend<E>(
  fn: (event: E, hint: unknown) => E | null | Promise<E | null>,
): (event: E, hint: unknown) => E | null | Promise<E | null> {
  return (event, hint) => {
    flushNeeded = true;
    return fn(event, hint);
  };
}

// Set at the capture site, synchronously. beforeSend runs only at the end of
// Sentry's async pipeline (it reads source files for context lines), which is
// after the function's finally block has already asked takeFlushNeeded.
export function markFlushNeeded(): void {
  flushNeeded = true;
}

export function takeFlushNeeded(): boolean {
  const was = flushNeeded;
  flushNeeded = false;
  return was;
}
