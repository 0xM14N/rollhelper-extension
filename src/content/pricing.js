let pricesLoaded = false;
let isInitialized = false;

let rootObserverInstance = null;
let enablePricing
let lastUrl = location.href;

const NAV_SUPPRESS_MS = 900;
let injectionSuppressedUntil = 0;
let depositDrawerPresent = false;

function onViewTransition() {
    removeAllOverlays();
    injectionSuppressedUntil = Date.now() + NAV_SUPPRESS_MS;
    setTimeout(() => {
        if (!enablePricing) return;
        processExistingCards();
        refreshAllOverlays();
    }, NAV_SUPPRESS_MS + 50);
}

setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        onViewTransition();
    }

    const drawer = !!document.querySelector('.deposit-section-promo');
    if (drawer !== depositDrawerPresent) {
        depositDrawerPresent = drawer;
        onViewTransition();
    }

    sweepCoveredOverlays();
}, 200);

document.addEventListener('animationstart', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement &&
        Array.from(t.classList).some(c => c.startsWith('payment-anim'))) {
        onViewTransition();
    }
}, true);

function initializePricing() {
    isInitialized = true;

    const look4rates = setInterval(() => {
        if (rates && Object.keys(rates).length > 0) {
            clearInterval(look4rates);

            // Check if prices are also loaded
            if (window.prices && Object.keys(window.prices || {}).length > 0) {
                pricesLoaded = true;
                // console.log('[RollHelper] Rates AND prices loaded together');
            } else {
                // console.log('[RollHelper] Rates loaded, but prices not yet available');
            }

            injectStyles();
            processExistingCards();
            start();
        }
    }, 500);

    setTimeout(() => {
        if (!document.getElementById('rollhelper-extension-styles')) {
            // console.log('[RollHelper] Fallback timeout triggered, starting without prices');
            injectStyles();
            processExistingCards();
            start();
        }
    }, 5000);
}

const watchPrices = setInterval(() => {
    if (!pricesLoaded && window.prices && Object.keys(window.prices || {}).length > 0) {
        pricesLoaded = true;
        refreshAllOverlays();
    }

    if (pricesLoaded) {
        const loadingCards = document.querySelectorAll('.buff-overlay .rh-loading');
        if (loadingCards.length > 0) {
            // console.log(`[RollHelper] Found ${loadingCards.length} cards still loading, refreshing...`);
            refreshAllOverlays();
        }
    }
}, 1000);

function removeAllOverlays() {
    document.querySelectorAll('.buff-overlay, .marketname-overlay, .rh-coin-usd').forEach(el => el.remove());
    document.querySelectorAll('[class~="group/card"][data-pricing-injected]').forEach(node => {
        delete node.dataset.pricingInjected;
    });
}

function showAllOverlays() {
    processExistingCards();
}

let lastPricingState = enablePricing;
let lastPricingPrefsKey = '';
function pricingPrefsKey() {
    const m = (typeof pricingMarkets !== 'undefined') ? pricingMarkets : { buff:true, csf:true, uu:true };
    const inf = (typeof pricingInflatedShown !== 'undefined') ? pricingInflatedShown : true;
    const liq = (typeof pricingLiquidityShown !== 'undefined') ? pricingLiquidityShown : true;
    const usd = (typeof pricingUsdPriceShown !== 'undefined') ? pricingUsdPriceShown : true;
    const card = (typeof cardLinkSkinPage !== 'undefined' && cardLinkSkinPage) ? 1 : 0;
    const rate = getRollUsdRate();
    return `${m.buff?1:0}${m.csf?1:0}${m.uu?1:0}|${inf?1:0}|${liq?1:0}|${usd?1:0}|${card}|${rate}`;
}
setInterval(() => {
    if (enablePricing !== lastPricingState) {
        lastPricingState = enablePricing;

        if (enablePricing) {
            initializePricing();
            showAllOverlays();
        } else {
            removeAllOverlays();
        }
    }

    if (enablePricing) {
        const k = pricingPrefsKey();
        if (k !== lastPricingPrefsKey) {
            lastPricingPrefsKey = k;
            refreshAllOverlays();
        }
    }
}, 200);

// Initial setup
if (enablePricing) {
    initializePricing();
}

function isItemCard(node) {
    return !!(
        node.querySelector('img[class~="drop-shadow-lg"]') &&
        node.querySelector('img[data-testid="currency-image"]')
    );
}


function isCardVisible(card) {
    const rect = card.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return true;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) return true;
    const top = document.elementFromPoint(cx, cy);
    if (!top) return true;
    if (card.contains(top) || card === top) return true;

    return !top.closest('.deposit-section-promo, [class*="payment-anim"]');
}

function sweepCoveredOverlays() {
    if (!enablePricing) return;
    document
        .querySelectorAll('[class~="group/card"][data-pricing-injected="true"]')
        .forEach(card => {
            if (isCardVisible(card)) return;
            card.querySelectorAll(':scope > .buff-overlay, :scope > .marketname-overlay').forEach(el => el.remove());
            card.querySelectorAll('.rh-coin-usd').forEach(el => el.remove());
            delete card.dataset.pricingInjected;
        });
}

function maybeInject(node) {
    if (!enablePricing) return;
    if (!(node instanceof HTMLElement)) return;
    if (!node.matches?.('[class~="group/card"]')) return;
    if (node.dataset.pricingInjected) return;
    if (!isItemCard(node)) return;
    if (!isCardVisible(node)) return;

    node.dataset.pricingInjected = 'true';
    const data = getPricing(node);

    if (Date.now() < injectionSuppressedUntil) data.noPrices = true;
    injectOverlay(node, data);
}

function getCardRoot() {
    return document.getElementById('main-div') || document.body;
}

function start() {
    const root = getCardRoot();

    root.querySelectorAll('[class~="group/card"]').forEach(maybeInject);

    if (rootObserverInstance) {
        rootObserverInstance.disconnect();
    }

    rootObserverInstance = new MutationObserver(mutations => {
        if (!enablePricing) return;
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;

                if (node.matches?.('[class~="group/card"]')) {
                    maybeInject(node);
                }

                node
                    .querySelectorAll?.('[class~="group/card"]')
                    .forEach(maybeInject);
            }
        }
    });

    rootObserverInstance.observe(root, {
        childList: true,
        subtree: true,
    });
}

function processExistingCards() {
    document
        .querySelectorAll('[class~="group/card"]')
        .forEach(node => maybeInject(node));
}

function refreshAllOverlays() {
    const cards = document.querySelectorAll('[class~="group/card"][data-pricing-injected="true"]');

    cards.forEach(node => {
        const existingOverlay = node.querySelector(':scope > .buff-overlay');
        const existingHeading = node.querySelector(':scope > .marketname-overlay');

        if (existingOverlay) {
            existingOverlay.remove();
        }
        if (existingHeading) existingHeading.remove();
        node.querySelectorAll('.rh-coin-usd').forEach(el => el.remove());

        const data = getPricing(node);
        injectOverlay(node, data);
    });
}

const WEAR_ABBR = {
    FN: 'Factory New',
    MW: 'Minimal Wear',
    FT: 'Field-Tested',
    WW: 'Well-Worn',
    BS: 'Battle-Scarred',
};

const VARIANT_COLORS = {
    'Sticker': {
        'rgb(156,102,255)': 'Holo',
        'rgb(216,92,230)': 'Foil',
        'rgb(230,92,92)': 'Gold',
    },
    'Patch': {
        'rgb(156,102,255)': 'Gold',
    },
};

function normRgb(c) {
    return (c || '').replace(/\s+/g, '');
}

function getItemVariant(card, category) {
    const table = VARIANT_COLORS[category];
    if (!table) return null;
    const dot = card.querySelector('[class~="w-1.75"]');
    if (!dot) return null;
    const color = normRgb(getComputedStyle(dot).backgroundColor);
    return table[color] || null;
}

// "Sticker | Avangar | Boston 2018" -> "Sticker | Avangar (Holo) | Boston 2018"
// "Patch | MOUZ | Stockholm 2021"   -> "Patch | MOUZ (Gold) | Stockholm 2021"
function applyVariant(itemName, variant) {
    const parts = itemName.split(' | ');
    if (parts.length < 2) return itemName;
    parts[1] = `${parts[1]} (${variant})`;
    return parts.join(' | ');
}

function getPricing(card, include_pricing = "true") {
    let itemInfo = {}

    // --- main item image: alt = display name (incl. wear + doppler phase inline) ---
    const mainImg =
        card.querySelector('img[class~="drop-shadow-lg"]') ||
        card.querySelector('[class~="max-w-39.5"] img');
    const alt = (mainImg?.getAttribute('alt') || '').trim();

    // --- category / type span (weapon w/ ★ & StatTrak™, "Sticker", "Case", agent …) ---
    const catEl = card.querySelector('span.text-2xs[class~="text-gray-100"]');
    const category = (catEl?.textContent || '').trim();
    itemInfo.skinWeapon = category;

    // --- skin / variant name span ("Redline", "Doppler Phase 2", "KOI | Copenhagen 2024") ---
    const nameEl = card.querySelector('span[class~="min-h-5"]');
    const skin = (nameEl?.textContent || '').trim();
    if (skin) itemInfo.skinName = skin;

    // --- wear: trailing "(...)" of the alt (e.g. "Battle-Scarred"); absent on stickers ---
    let exterior = null;
    const wearMatch = alt.match(/\(([^)]+)\)\s*$/);
    if (wearMatch) exterior = wearMatch[1].trim();

    // fallback: deposit-page cards omit the wear from alt; it lives in the
    // float-bar span as "FN - 0.020" / "BS - 0.812" / etc. Match by text pattern.
    if (!exterior) {
        const wearSpan = Array.from(card.querySelectorAll('span'))
            .find(sp => /^(FN|MW|FT|WW|BS)\b/.test((sp.textContent || '').trim()));
        if (wearSpan) {
            const abbr = wearSpan.textContent.trim().match(/^(FN|MW|FT|WW|BS)\b/)[1];
            exterior = WEAR_ABBR[abbr];
        }
    }
    if (exterior) itemInfo.wear = exterior;

    // --- build the market name: "<category> | <skin>", then "(wear)" for weapon skins ---
    let itemName = skin ? `${category} | ${skin}` : category;
    if (exterior && itemName.includes('|')) {
        itemName += ` (${exterior})`;
    }

    // --- sticker/patch finish (Holo/Foil/Gold) inferred from the rarity-square colour ---
    const variant = getItemVariant(card, category);
    if (variant) itemName = applyVariant(itemName, variant);

    // --- coin price: text of the span that holds the currency icon ---
    const curImg = card.querySelector('img[data-testid="currency-image"]');
    const priceText = curImg?.parentElement
        ? curImg.parentElement.textContent.replace(/[^\d.,]/g, '').replace(/,/g, '')
        : '';
    let rollPrice = priceText ? Math.floor(parseFloat(priceText) * 100) / 100 : 0;
    itemInfo.rollPrice = rollPrice;

    if (!window.prices || Object.keys(window.prices || {}).length === 0) {
        itemInfo.marketname = itemName;
        itemInfo.noPrices = true;
        itemInfo.cspurl = cspCardUrl(itemName);
        return itemInfo;
    }

    let rate;
    if (
        itemName.includes('Doppler') |
        itemName.includes('Sapphire') |
        itemName.includes('Ruby')
    ) {
        rate = 0.65;
    } else {
        rate = rates[itemName];
        if (rate === undefined) {
            rate = 0.66;
        } else {
            rate = rates[itemName].rate;
        }
    }

    // doppler phase/gem - CSPricebase key format ("… Doppler (FN) - Phase 2")
    if (isDoppler(itemName)) itemName = refactorDopplerNameForPE(itemName);

    // vanilla check (no "|" but has a wear)
    if (!itemName.includes("|") && itemInfo.wear) {
        itemName =  itemName.replace(/\s*\([^)]*\)/, '');
    }

    itemInfo.cspurl = cspCardUrl(itemName)

    let price_obj = prices[itemName];

    if (price_obj === undefined) {
        itemInfo.marketname = itemName;
        itemInfo.error = true;
        return itemInfo;
    }

    let buff_usd;
    let uu_usd;
    let csf_usd;
    let is_inflated;
    let liq;

    liq = price_obj?.liquidity != null ? Number(price_obj.liquidity.toFixed(0)) : 0;

    buff_usd = price_obj?.price_buff != null ? price_obj.price_buff / 100 : null;
    uu_usd = price_obj?.price_uu/100 || null;
    csf_usd = price_obj?.price_csfloat != null ? price_obj.price_csfloat / 100 : null;
    is_inflated = price_obj?.is_inflated ?? true;

    const buffDelta = calcDelta(rollPrice, buff_usd, rate);
    const csfDelta  = calcDelta(rollPrice, csf_usd, rate);
    let uuDelta  = calcDelta(rollPrice, uu_usd, rate);

    if (isDoppler(itemName)) {
        uuDelta = null;
        uu_usd = null;
    }

    itemInfo.marketname = itemName;
    itemInfo.rollPrice = rollPrice;
    itemInfo.rate = rate;
    itemInfo.buffUsd = buff_usd;
    itemInfo.csfUsd = csf_usd;
    itemInfo.uuUsd = uu_usd;
    itemInfo.buffDelta = buffDelta;
    itemInfo.csfDelta = csfDelta;
    itemInfo.uuDelta = uuDelta;
    itemInfo.liquidity = liq;
    itemInfo.isInflated = is_inflated;

    return itemInfo;
}

function ensurePositioned(node) {
    const style = getComputedStyle(node);
    if (style.position === 'static') {
        node.style.position = 'relative';
    }
}

function injectOverlay(node, data) {
    const existingOverlay = node.querySelector(':scope > .buff-overlay');
    const existingHeading = node.querySelector(':scope > .marketname-overlay');
    if (existingOverlay) existingOverlay.remove();
    if (existingHeading) existingHeading.remove();
    node.querySelectorAll('.rh-coin-usd').forEach(el => el.remove());

    ensurePositioned(node);

    const { overlay, heading_overlay } = createOverlay(data);

    if (heading_overlay) node.appendChild(heading_overlay);
    node.appendChild(overlay);

    injectCoinUsd(node, data);
}

function injectCoinUsd(node, data) {
    if (!data.rollPrice) return;

    const showUsd = (typeof pricingUsdPriceShown !== 'undefined') ? pricingUsdPriceShown : true;
    if (!showUsd) return;

    const curImg = node.querySelector('img[data-testid="currency-image"]');
    const priceSpan = curImg?.parentElement;
    if (!priceSpan) return;

    const rate = getRollUsdRate();
    const usd = data.rollPrice * rate;
    const label = document.createElement('span');
    label.className = 'rh-coin-usd';
    label.textContent = `≈ ${fmtUsd(usd)}`;
    label.title = `${data.rollPrice.toFixed(2)} coins × ${rate}`;

    // priceSpan -> price-row -> info column; drop the USD line just under the price row
    const host = priceSpan.parentElement?.parentElement || priceSpan.parentElement;
    host.appendChild(label);
}

function calcDelta(sitePrice, marketUsd, rate) {
    if (!marketUsd || !rate || marketUsd <= 0) return null;

    const marketCoins = marketUsd / rate;
    const delta = (sitePrice / marketCoins - 1) * 100;

    return Number(delta.toFixed(1));
}

const ROLL_USD_RATE_DEFAULT = 0.66;
function getRollUsdRate() {
    return (typeof pricingUsdRateValue !== 'undefined' && pricingUsdRateValue > 0)
        ? pricingUsdRateValue
        : ROLL_USD_RATE_DEFAULT;
}

const MARKET_META = {
    buff:  { key: 'buff',  label: 'Buff163',  icon: 'assets/ico/buff_logo.png' },
    csf:   { key: 'csf',   label: 'CSFloat',  icon: 'assets/ico/csfloat_logo.png' },
    uu:    { key: 'uu',    label: 'YouPin',   icon: 'assets/ico/uu_logo.png' },
};

function fmtDelta(d) {
    if (d == null || Number.isNaN(d)) return '–';
    const sign = d > 0 ? '+' : '';
    return `${sign}${d.toFixed(1)}%`;
}

function fmtUsd(v) {
    if (v == null || Number.isNaN(v)) return '–';
    return `$${v.toFixed(2)}`;
}

function deltaClass(d) {
    if (d == null || Number.isNaN(d)) return 'rh-neutral';
    if (d > 0) return 'rh-pos';
    return 'rh-neg';
}

function makeMarketRow(meta, usd, delta, coins, cspurl) {
    const row = document.createElement('a');
    row.className = `rh-row ${deltaClass(delta)}`;
    row.href = cspurl;
    row.target = '_blank';
    row.rel = 'noopener';
    row.title = `${meta.label} • ${fmtUsd(usd)}${coins != null ? ` • ${coins.toFixed(2)} coins` : ''} • View on CS:Pricebase`;
    row.addEventListener('click', e => e.stopPropagation());

    const icon = document.createElement('img');
    icon.className = 'rh-mkt-ico';
    icon.src = chrome.runtime.getURL(meta.icon);
    icon.alt = meta.label;

    const price = document.createElement('span');
    price.className = 'rh-mkt-price';
    price.textContent = fmtUsd(usd);

    const deltaEl = document.createElement('span');
    deltaEl.className = 'rh-mkt-delta';
    deltaEl.textContent = fmtDelta(delta);

    row.append(icon, price, deltaEl);
    return row;
}

function makeCspLink(cspurl) {
    const link = document.createElement('a');
    link.className = 'rh-csp-link';
    link.href = cspurl;
    link.target = '_blank';
    link.title = 'View on CS:Pricebase';
    link.addEventListener('click', e => e.stopPropagation());

    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('assets/ico/csp.png');
    img.alt = 'CS:Pricebase';
    img.className = 'rh-csp-ico';
    link.appendChild(img);
    return link;
}

function liqClass(liq) {
    if (liq >= 70) return 'rh-liq-high';
    if (liq >= 40) return 'rh-liq-mid';
    return 'rh-liq-low';
}

function createOverlay(data) {
    // console.log(data)
    const overlay = document.createElement('div');
    overlay.className = 'buff-overlay';

    const heading_overlay = document.createElement('div');
    heading_overlay.className = 'marketname-overlay';
    heading_overlay.title = 'Click to copy market name';
    heading_overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(data.marketname);
        heading_overlay.classList.add('rh-copied');
        setTimeout(() => heading_overlay.classList.remove('rh-copied'), 700);
    });
    heading_overlay.innerHTML = `<span class="rh-copy-ico">⧉</span><span class="rh-copy-text">copy</span>`;

    const container = document.createElement('div');
    container.className = 'rollhelper-container';

    const stack = document.createElement('div');
    stack.className = 'rh-stack';

    if (data.noPrices) {
        const loading = document.createElement('div');
        loading.className = 'rh-row rh-loading';
        loading.textContent = 'loading…';
        stack.appendChild(loading);
        container.append(stack, makeCspLink(data.cspurl));
        overlay.appendChild(container);
        return { overlay, heading_overlay };
    }

    if (data.error) {
        // console.log(data.error)
        const err = document.createElement('div');
        err.className = 'rh-row rh-err';
        err.textContent = 'no price';
        stack.appendChild(err);
        container.append(stack, makeCspLink(data.cspurl));
        overlay.appendChild(container);
        return { overlay, heading_overlay };
    }

    const showInflated = (typeof pricingInflatedShown !== 'undefined') ? pricingInflatedShown : true;
    const visible = (typeof pricingMarkets !== 'undefined')
        ? pricingMarkets
        : { buff: true, csf: true, uu: true };

    const hideMarkup = data.isInflated && !showInflated;

    const rows = [];
    if (!hideMarkup) {
        const rate = data.rate || 1;
        if (visible.buff && data.buffUsd != null) {
            rows.push(makeMarketRow(MARKET_META.buff, data.buffUsd, data.buffDelta, data.buffUsd / rate, data.cspurl));
        }
        if (visible.csf && data.csfUsd != null) {
            rows.push(makeMarketRow(MARKET_META.csf, data.csfUsd, data.csfDelta, data.csfUsd / rate, data.cspurl));
        }
        if (visible.uu && data.uuUsd != null) {
            rows.push(makeMarketRow(MARKET_META.uu, data.uuUsd, data.uuDelta, data.uuUsd / rate, data.cspurl));
        }
    } else {
        const inflMsg = document.createElement('div');
        inflMsg.className = 'rh-row rh-inflated-msg';
        inflMsg.title = 'Markup hidden: prices flagged as inflated.\nEnable "Show inflated" in popup to view.';
        inflMsg.textContent = 'inflated · hidden';
        rows.push(inflMsg);
    }

    if (rows.length > 0 && data.isInflated) {
        const topLine = document.createElement('div');
        topLine.className = 'rh-top-line';
        topLine.appendChild(rows[0]);

        const infl = document.createElement('div');
        infl.className = 'rh-inflated';
        infl.title = 'Prices flagged as inflated by CS:Pricebase';
        infl.textContent = '⚠';
        topLine.appendChild(infl);

        stack.appendChild(topLine);
        for (let i = 1; i < rows.length; i++) stack.appendChild(rows[i]);
    } else {
        rows.forEach(r => stack.appendChild(r));
    }

    const showLiq = (typeof pricingLiquidityShown !== 'undefined') ? pricingLiquidityShown : true;
    container.appendChild(stack);

    if (showLiq) {
        const liqEl = document.createElement('div');
        liqEl.className = `rh-liq ${liqClass(data.liquidity)}`;
        liqEl.title = 'Market liquidity';
        liqEl.innerHTML = `<span class="rh-liq-label">LIQ</span><span class="rh-liq-val">${data.liquidity}%</span>`;
        container.appendChild(liqEl);
    }

    container.appendChild(makeCspLink(data.cspurl));
    overlay.appendChild(container);

    return { overlay, heading_overlay };
}

function injectStyles() {
    if (document.getElementById('rollhelper-extension-styles')) return;

    const style = document.createElement('style');
    style.id = 'rollhelper-extension-styles';

    style.textContent = `
    /* === RollHelper Pricing Overlay === */
    .buff-overlay {
        position: absolute;
        inset: 0;
        z-index: 999;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 11px;
        line-height: 1.15;
        font-variant-numeric: tabular-nums;
    }
    .marketname-overlay {
        position: absolute;
        top: 6px;
        right: 6px;
        z-index: 1000;
        pointer-events: auto;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 6px;
        font-size: 10px;
        font-weight: 600;
        color: #d1d5db;
        background: rgba(15, 18, 24, 0.78);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 6px;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
    }
    .marketname-overlay:hover {
        color: #fff;
        background: rgba(15, 18, 24, 0.92);
        transform: translateY(-1px);
    }
    .marketname-overlay.rh-copied {
        background: rgba(0, 199, 77, 0.85);
        color: #fff;
        border-color: rgba(0, 199, 77, 0.9);
    }
    .marketname-overlay .rh-copy-ico { font-size: 11px; line-height: 1; }
    .marketname-overlay .rh-copy-text { letter-spacing: 0.4px; text-transform: uppercase; font-size: 9px; }

    .rollhelper-container {
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    /* === Price stack (top-left) === */
    .rh-stack {
        position: absolute;
        top: 6px;
        left: 6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        pointer-events: auto;
    }

    .rh-row {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 6px 2px 3px;
        background: rgba(15, 18, 24, 0.78);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 999px;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        white-space: nowrap;
        text-decoration: none;
        cursor: pointer;
        transition: transform 0.15s ease, background 0.15s ease;
    }
    a.rh-row { color: inherit; }
    .rh-row:hover {
        background: rgba(15, 18, 24, 0.92);
        transform: translateX(2px);
    }

    .rh-mkt-ico {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
        background: #fff;
        padding: 1px;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.25);
    }

    .rh-mkt-price {
        color: #e8eaed;
        font-weight: 500;
        font-size: 10.5px;
    }

    .rh-mkt-delta {
        font-weight: 700;
        font-size: 10.5px;
        letter-spacing: 0.2px;
    }

    .rh-pos .rh-mkt-delta { color: #ff5c5c; }
    .rh-neg .rh-mkt-delta { color: #3bd671; }
    .rh-neutral .rh-mkt-delta { color: #9ca3af; }

    .rh-pos { box-shadow: inset 2px 0 0 #ff5c5c; }
    .rh-neg { box-shadow: inset 2px 0 0 #3bd671; }
    .rh-neutral { box-shadow: inset 2px 0 0 #6b7280; }

    .rh-loading {
        color: #ffeb3b;
        font-style: italic;
        font-weight: 500;
    }
    .rh-err {
        color: #ff8a8a;
        font-weight: 600;
    }
    .rh-inflated-msg {
        color: #ffb347;
        font-style: italic;
        font-size: 10px;
        font-weight: 500;
    }

    /* USD equivalent shown directly under the coin balance on the card */
    .rh-coin-usd {
        display: block;
        margin-top: 1px;
        font-size: 10px;
        font-weight: 600;
        color: #9ca3af;
        letter-spacing: 0.2px;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
        cursor: help;
    }

    /* First row + inflated badge inline */
    .rh-top-line {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        pointer-events: auto;
    }

    /* Liquidity pill — bottom-center */
    .rh-liq {
        position: absolute;
        bottom: 4px;
        left: 50%;
        transform: translateX(-50%);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 7px;
        background: rgba(15, 18, 24, 0.82);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 999px;
        font-size: 10px;
        font-weight: 600;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        pointer-events: auto;
    }
    .rh-liq-label {
        color: #6b7280;
        letter-spacing: 0.5px;
        font-size: 9px;
    }
    .rh-liq-val { font-weight: 700; }
    .rh-liq-high .rh-liq-val { color: #3bd671; }
    .rh-liq-mid  .rh-liq-val { color: #ffd166; }
    .rh-liq-low  .rh-liq-val { color: #ff8a8a; }

    .rh-inflated {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        font-size: 11px;
        color: #ffb347;
        background: rgba(255, 179, 71, 0.15);
        border: 1px solid rgba(255, 179, 71, 0.4);
        border-radius: 50%;
        cursor: help;
        flex-shrink: 0;
    }

    /* CSP link — bottom-right */
    .rh-csp-link {
        position: absolute;
        bottom: 3px;
        right: 3px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 1px;
        border-radius: 6px;
        transition: transform 0.15s ease, filter 0.15s ease;
        pointer-events: auto;
    }
    .rh-csp-link:hover {
        transform: scale(1.1);
        filter: brightness(1.15);
    }
    .rh-csp-ico {
        width: 26px;
        height: 26px;
        display: block;
        border-radius: 4px;
    }
`;
    document.head.appendChild(style);
}