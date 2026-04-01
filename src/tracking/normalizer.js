const KNOWN_STATUSES = new Set([
  'JOINED', 'PROCESSING', 'COMPLETED', 'COMPLETED_PROTECTED',
  'COOLDOWN', 'CANCELLED', 'EXPIRED',
]);

const normalizer = {
  async normalize(raw, sessionId, pricingData) {
    if (!raw || !raw.tradeId || !raw.status || !raw.side) {
      return null;
    }

    const trade = raw.rawTrade;
    if (!trade) return null;

    const tradeItem = trade.tradeItems?.[0];
    if (!tradeItem) return null;

    const itemName = tradeItem.marketName || tradeItem.itemVariant?.externalId || "";
    if (!itemName) return null;

    const csgorollTimestamp =
        trade.updatedAt || trade.createdAt || new Date().toISOString();

    const idempotencyKey = await signer.idempotencyKey(
      raw.tradeId,
      raw.status,
      csgorollTimestamp
    );

    const status = KNOWN_STATUSES.has(raw.status) ? raw.status : 'OTHER';

    let pricingSnapshot = null;
    if (pricingData) {
      const lookupName = getLookupName(itemName);
      const priceObj = pricingData[lookupName];
      if (priceObj) {
        pricingSnapshot = {
          buffUsd: priceObj.price_buff ? priceObj.price_buff / 100 : null,
          csfloatUsd: priceObj.price_csfloat ? priceObj.price_csfloat / 100 : null,
          youpinUsd: priceObj.price_uu ? priceObj.price_uu / 100 : null,
          liquidity: priceObj.liquidity ?? null,
        };
      }
    }

    let stickers = null;
    if (tradeItem.stickers && tradeItem.stickers.length > 0) {
      stickers = tradeItem.stickers.map((s) => ({
        name: s.name,
        wear: s.wear ?? null,
        value: s.value ?? null,
        color: s.color ?? null,
      }));
    }

    return {
      idempotencyKey,
      tradeId: String(raw.tradeId),
      status,
      side: raw.side,
      itemName,
      itemExterior: extractExterior(itemName),
      coinValue: tradeItem.value || raw.coinValue || 0,
      markup: tradeItem.markupPercent ?? raw.markup ?? null,
      maxMarkup: raw.maxMarkup ?? null,
      steamAssetId: tradeItem.steamExternalAssetId ?? null,
      csgorollTimestamp,
      clientTimestamp: Date.now(),
      pricingSnapshot,
      stickers,
    };
  },
};

function extractExterior(name) {
  const match = name.match(
    /\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/
  );
  if (!match) return null;
  const map = {
    "Factory New": "FN",
    "Minimal Wear": "MW",
    "Field-Tested": "FT",
    "Well-Worn": "WW",
    "Battle-Scarred": "BS",
  };
  return map[match[1]] || null;
}

function getLookupName(marketName) {
  if (typeof refactorDopplerNameForPE === "function" && isDoppler(marketName)) {
    return refactorDopplerNameForPE(marketName);
  }
  return marketName;
}