const QUEUE_STORAGE_KEY = "tracking_queue";
const MAX_QUEUE_SIZE = 10000;

const trackingQueue = {
  async getAll() {
    const result = await chrome.storage.local.get(QUEUE_STORAGE_KEY);
    return result[QUEUE_STORAGE_KEY] || [];
  },

  async add(event) {
    const queue = await this.getAll();
    queue.push(event);

    if (queue.length > MAX_QUEUE_SIZE) {
      queue.splice(0, queue.length - MAX_QUEUE_SIZE);
    }

    await chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: queue });
  },

  async addBatch(events) {
    const queue = await this.getAll();
    queue.push(...events);

    if (queue.length > MAX_QUEUE_SIZE) {
      queue.splice(0, queue.length - MAX_QUEUE_SIZE);
    }

    await chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: queue });
  },

  async removeBatch(idempotencyKeys) {
    const keySet = new Set(idempotencyKeys);
    const queue = await this.getAll();
    const filtered = queue.filter((e) => !keySet.has(e.idempotencyKey));
    await chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: filtered });
  },

  async clear() {
    await chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: [] });
  },

  async size() {
    const queue = await this.getAll();
    return queue.length;
  },
};