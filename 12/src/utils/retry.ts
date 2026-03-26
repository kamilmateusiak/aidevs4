const wait = async (timeInMs: number) => {
    console.log("  [wait] ", timeInMs)
    return new Promise<void>((resolve) => {
        setTimeout(async () => {
            resolve();
        }, timeInMs)
    }) 
}

export async function withRetry(
  fn: () => Promise<Response>,
  maxRetries = 10
): Promise<Response> {
    const baseDelay = 2000;

    for (let i = 0; i < maxRetries; i++) {
        const response = await fn();

        const expDelay = baseDelay * 2**i + Math.random() * 1000;

        if (response.status === 503) {
            await wait(expDelay);
            continue;
        }

        if (response.status === 429) {
            const resetTimestamp = Number(response.headers.get('x-ratelimit-reset')) * 1000;
            console.log(`  [retry] resetTimestamp: ${resetTimestamp}`)
            const now = Date.now();
            
            const resetDelay = resetTimestamp > now ? resetTimestamp - now + baseDelay + Math.random() * 1000 : expDelay;
            await wait(resetDelay);
            continue;
        }

        return response;
    }

    throw new Error("Reached max retries count from API - let know the user.")
}
