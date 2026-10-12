// Dynamic imports cannot be cancelled. Settle the UI and ignore late completion instead.
export async function loadWithTimeout<T>(load: () => Promise<T>, timeoutMs = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(load),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Application module loading timed out')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
