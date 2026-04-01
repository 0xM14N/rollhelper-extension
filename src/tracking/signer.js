const signer = {
  async sign(apiKey, payload, timestamp) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const msgData = encoder.encode(payload + timestamp);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  },

  async idempotencyKey(tradeId, status, csgorollTimestamp) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${tradeId}:${status}:${csgorollTimestamp}`);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  },
};