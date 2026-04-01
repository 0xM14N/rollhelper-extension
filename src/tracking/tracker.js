const INGEST_URL = "https://cspricebase.com/api/ingest/trades";
const BATCH_SIZE = 25;
const BATCH_INTERVAL_MS = 5000;
const MAX_RETRIES = 5;

class TradeTracker {
  constructor() {
    this.sessionId = crypto.randomUUID();
    this.pendingBatch = [];
    this.batchTimer = null;
    this.sending = false;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    // Recover unsent events
    const queued = await trackingQueue.getAll();
    if (queued.length > 0) {
      console.log(
        `[TradeTracker] Recovered ${queued.length} unsent events from queue`
      );
      this.pendingBatch = queued;
      this.scheduleBatch();
    }
  }

  async trackEvent(rawPayload, pricingData) {
    try {
      const normalized = await normalizer.normalize(
        rawPayload,
        this.sessionId,
        pricingData
      );
      if (!normalized) return;

      await trackingQueue.add(normalized);
      this.pendingBatch.push(normalized);

      if (this.pendingBatch.length >= BATCH_SIZE) {
        this.flush();
      } else {
        this.scheduleBatch();
      }
    } catch (err) {
      console.error("[TradeTracker] Error tracking event:", err);
    }
  }

  scheduleBatch() {
    if (this.batchTimer) return;
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.flush();
    }, BATCH_INTERVAL_MS);
  }

  async flush() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.pendingBatch.length === 0 || this.sending) return;
    this.sending = true;

    const batch = this.pendingBatch.splice(0, BATCH_SIZE);

    const storage = await chrome.storage.sync.get(['trackingApiKey'])
    const apiKey = storage.trackingApiKey;

    const storage_id = await chrome.storage.sync.get(['currentUserId'])
    const userId = storage_id.currentUserId;

    if (!apiKey || !userId) {
      if (!apiKey) console.warn("[TradeTracker] No tracking key configured");
      if (!userId) console.warn("[TradeTracker] No currentUserId set");
      this.pendingBatch = [...batch, ...this.pendingBatch];
      this.sending = false;
      this.scheduleBatch();
      return;
    }

    const body = JSON.stringify({
      events: batch,
      extensionVersion: chrome.runtime.getManifest().version,
      sessionId: this.sessionId,
      currentUser: userId
    });

    const timestamp = Date.now().toString();

    let signature;
    try {
      signature = await signer.sign(apiKey, body, timestamp);
    } catch (err) {
      console.error("[TradeTracker] Signing failed:", err);
      this.pendingBatch = [...batch, ...this.pendingBatch];
      this.sending = false;
      this.scheduleBatch();
      return;
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(INGEST_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "X-Signature": signature,
            "X-Timestamp": timestamp,
          },
          body,
        });

        if (res.ok) {
          const result = await res.json();
          console.log(
            `[TradeTracker] Batch sent: ${result.accepted} accepted, ${result.duplicates} duplicates`
          );
          await trackingQueue.removeBatch(
            batch.map((e) => e.idempotencyKey)
          );
          this.sending = false;

          if (this.pendingBatch.length > 0) {
            this.scheduleBatch();
          }
          return;
        }

        if (res.status === 429) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 30000);
          console.log(
            `[TradeTracker] Rate limited, retrying in ${backoff}ms`
          );
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        if (res.status >= 400 && res.status < 500) {
          let errBody = '';
          try { errBody = await res.text(); } catch {}
          // console.error(
          //   `[TradeTracker] Client error ${res.status}, dropping batch:`, errBody
          // );
          // console.error('[TradeTracker] First event in batch:', JSON.stringify(batch[0], null, 2));
          await trackingQueue.removeBatch(
            batch.map((e) => e.idempotencyKey)
          );
          this.sending = false;
          return;
        }

        const backoff = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.log(
          `[TradeTracker] Server error ${res.status}, retrying in ${backoff}ms`
        );
        await new Promise((r) => setTimeout(r, backoff));
      } catch (err) {
        const backoff = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.log(
          `[TradeTracker] Network error, retrying in ${backoff}ms:`,
          err.message
        );
        await new Promise((r) => setTimeout(r, backoff));
      }
    }

    console.warn(
      `[TradeTracker] All retries exhausted, re-queuing ${batch.length} events`
    );
    this.pendingBatch = [...batch, ...this.pendingBatch];
    this.sending = false;
    this.scheduleBatch();
  }

  async getStatus() {
    const queueSize = await trackingQueue.size();
    return {
      sessionId: this.sessionId,
      pendingBatch: this.pendingBatch.length,
      queueSize,
      sending: this.sending,
    };
  }
}

const tradeTracker = new TradeTracker();