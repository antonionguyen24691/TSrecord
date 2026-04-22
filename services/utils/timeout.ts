export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Yeu cau het thoi gian. Vui long thu lai.'
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timeoutId);
      });
  });

