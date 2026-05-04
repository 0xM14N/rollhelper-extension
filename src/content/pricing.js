let pricesLoaded = false;
let isInitialized = false;

let activeObserversMap = new Map();
let rootObserverInstance = null;
let enablePricing
let lastPath = location.pathname;

setInterval(() => {
    if (location.pathname !== lastPath) {
        lastPath = location.pathname;

        removeAllOverlays();
        processExistingCards();
    }
}, 200);

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
        const loadingCards = document.querySelectorAll('.buff-overlay .loading');
        if (loadingCards.length > 0) {
            // console.log(`[RollHelper] Found ${loadingCards.length} cards still loading, refreshing...`);
            refreshAllOverlays();
        }
    }
}, 1000);

function removeAllOverlays() {
    document.querySelectorAll('.buff-overlay, .marketname-overlay, .rh-coin-usd').forEach(el => el.remove());
    document.querySelectorAll('cw-csgo-market-item-card[data-pricing-injected]').forEach(node => {
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
    const rate = getRollUsdRate();
    return `${m.buff?1:0}${m.csf?1:0}${m.uu?1:0}|${inf?1:0}|${liq?1:0}|${usd?1:0}|${rate}`;
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

function maybeInject(node) {
    if (!enablePricing) return;
    if (!(node instanceof HTMLElement)) return;
    if (node.localName !== 'cw-csgo-market-item-card') return;
    if (node.dataset.pricingInjected) return;

    const firstEl = node.firstElementChild;
    if (!firstEl || firstEl.classList.contains('horizontal')) return;

    node.dataset.pricingInjected = 'true';
    const data = getPricing(node);
    injectOverlay(node, data);
}

function observeContainer(container) {
    container
        .querySelectorAll('cw-csgo-market-item-card')
        .forEach(maybeInject);

    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;

                if (node.matches?.('cw-csgo-market-item-card')) {
                    maybeInject(node);
                }

                node
                    .querySelectorAll?.('cw-csgo-market-item-card')
                    .forEach(maybeInject);
            }
        }
    });

    observer.observe(container, {
        childList: true,
        subtree: true,
    });

    return observer;
}

function start() {
    const containerSelectors = [
        'cw-player-to-player-deposit',
        'cw-withdraw',
    ];

    function tryAttach() {
        if (!enablePricing) return;

        for (const [selector, observer] of activeObserversMap.entries()) {
            if (!document.querySelector(selector)) {
                observer.disconnect();
                activeObserversMap.delete(selector);
            }
        }

        for (const selector of containerSelectors) {
            if (activeObserversMap.has(selector)) continue;

            const container = document.querySelector(selector);
            if (!container) continue;

            const observer = observeContainer(container);
            activeObserversMap.set(selector, observer);
        }
    }

    tryAttach();

    if (rootObserverInstance) {
        rootObserverInstance.disconnect();
    }

    rootObserverInstance = new MutationObserver(tryAttach);
    rootObserverInstance.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

function processExistingCards() {
    document
        .querySelectorAll('cw-csgo-market-item-card')
        .forEach(node => maybeInject(node));
}

function refreshAllOverlays() {
    const cards = document.querySelectorAll('cw-csgo-market-item-card[data-pricing-injected="true"]');

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


function getPricing(item, include_pricing = "true") {
    let itemInfo = {}
    let itemName = '';
    let isSticker = false;
    let isStickered = false;

    let stickeredItem = item.querySelector(
        'div:nth-child(1) > div:nth-child(1) > div:nth-child(5) > span:nth-child(2)',
    );

    let normalItem = item.querySelector(
        'div:nth-child(1) > div:nth-child(1) > div:nth-child(4) > span:nth-child(2)',
    );

    if (
        item.querySelector(
            'div:nth-child(1) > div:nth-child(1) > div:nth-child(4) > span:nth-child(2)',
        )
    ) {
        itemInfo.skinWeapon = item
            .querySelector(
                'div:nth-child(1) > div:nth-child(1) > div:nth-child(4) > span:nth-child(2)',
            )
            .innerHTML.trim();
        // is non-stickered
        if (itemInfo.skinWeapon === 'Sticker') {
            isSticker = true;
            itemName += 'Sticker | ';
        } else {
            itemName += itemInfo.skinWeapon;
        }
    } else {
        // is stickered
        itemInfo.skinWeapon = item
            .querySelector(
                'div:nth-child(1) > div:nth-child(1) > div:nth-child(5) > span:nth-child(2)',
            )
            .innerHTML.trim();
        itemName += itemInfo.skinWeapon;
        isStickered = true;
    }

    // SKIN NAME  ===============================================================
    if (item.querySelector('div:nth-child(1) > div:nth-child(1) > label')) {
        if (isSticker) {
            let skin = item
                .querySelector('div:nth-child(1) > div:nth-child(1) > label')
                .innerHTML.trim();
            itemName += skin;
        } else {
            let skin = item
                .querySelector('div:nth-child(1) > div:nth-child(1) > label')
                .innerHTML.trim();
            let nameArr = skin.split(' ');
            let f = nameArr[0];
            let s = nameArr[1];

            // if doppler has a phase
            if (f == 'Doppler') {
                itemInfo.skinName = 'Doppler';
                itemName += ' | ' + 'Doppler';
                var phase = s + ' ' + nameArr[2];
            }

            // if doppler is a gem
            else if (nameArr.length === 1 && (f == 'Ruby' || f == 'Sapphire')) {
                itemInfo.skinName = f;
                itemName += ' | ' + 'Doppler';
                var phase = f;
            }

            // if doppler is a Black Pearl
            else if (f == 'Black' && s == 'Pearl') {
                itemInfo.skinName = 'Black Pearl';
                itemName += ' | ' + 'Doppler';
                var phase = 'Black Pearl';
            }

            // if doppler is a gamma doppler
            else if (f == 'Gamma' && s == 'Doppler') {
                itemInfo.skinName = f + ' ' + s;
                itemName += ' | ' + 'Gamma Doppler';
                var phase = nameArr[2] + ' ' + nameArr[3];
            }

            // if gamma doppler is a gem -> emerald
            else if (nameArr.length === 1 && f == 'Emerald' && (isKnife(itemName) || itemName.includes('Glock'))) {
                itemInfo.skinName = f;
                itemName += ' | ' + 'Gamma Doppler';
                var phase = 'Emerald';
            } else if (
                itemInfo.skinWeapon.includes('Case') ||
                itemInfo.skinWeapon.includes('Pin')
            ) {
                // continue
            } else if (!skin) {
                // continue
            } else {
                itemInfo.skinName = skin;
                itemName += ' | ' + skin;
            }
        }
    }

    // SKIN EXTERIOR   ===============================================================
    let extEl;
    let exterior;
    extEl = item.querySelector("cw-item-float-wear-info > span") // deposit page selector
    if (extEl){
        // we are on depo page
        exterior = extEl.innerText.trim().split(" ")[0]
        // sticker wear
        if (isSticker) {
            // Sticker | FURIA | Stockholm 2021
            // Sticker | FURIA (Holo) | Stockholm 2021
            exterior = item.querySelector('div > div > div > span:nth-child(2)').innerText
            exterior = formatExterior(exterior);

            itemName = itemName.replace(
                /(Sticker \| [^|]+)( \| .+)/,
                `$1 (${exterior})$2`
            );

            itemInfo.wear = exterior;
        }

        // ...
    }else {
        // we are probably on p2p page
        extEl = item.querySelector("cw-item-details > div:nth-child(2) > div:nth-child(1) > span") // p2p selector
        if (extEl) {
            exterior = extEl.innerText.trim().split(" ")[0];
        }
        if (isSticker) {
            exterior = item.querySelector('div > div > div > span:nth-child(2)').innerText // holo glitter etc..
            if (exterior != "Sticker") {
                let nameArr = itemName.split(' ');
                let f = 0;
                for (let i = 0; i < nameArr.length; i++) {
                    if (nameArr[i] === '|') {
                        f++;
                        if (f === 2) {
                            exterior = exterior.toLowerCase().charAt(0).toUpperCase() + exterior.slice(1).toLowerCase();
                            nameArr[i - 1] += ` (${exterior})`;
                            break;
                        }
                    }
                }
                itemName = nameArr.join(' ');
            }
        }
    }

    switch (exterior) {
        case "FN":
            itemName += ' (Factory New)';
            itemInfo.wear = 'Factory New'
            break;
        case "MW":
            itemName += ' (Minimal Wear)';
            itemInfo.wear = 'Minimal Wear'
            break;
        case "FT":
            itemName += ' (Field-Tested)';
            itemInfo.wear = 'Field-Tested'
            break;
        case "WW":
            itemName += ' (Well-Worn)';
            itemInfo.wear = 'Well-Worn'
            break;
        case "BS":
            itemName += ' (Battle-Scarred)';
            itemInfo.wear = 'Battle-Scarred'
            break;
    }

    let rollPrice;

    if (!isStickered) {
        rollPrice =
            Math.floor(
                item
                    .querySelector(
                        'div:nth-child(1) > div:nth-child(1) > ' +
                        'div:nth-child(6) > cw-pretty-balance > span',
                    )
                    .innerText.replace(',', '') * 100,
            ) / 100;
    } else {
        rollPrice =
            Math.floor(
                item
                    .querySelector(`cw-pretty-balance > span`)
                    .innerText.replace(',', '') * 100,
            ) / 100;
    }

    itemInfo.rollPrice = rollPrice;

    if (!window.prices || Object.keys(window.prices || {}).length === 0) {
        itemInfo.marketname = itemName;
        itemInfo.noPrices = true;
        itemInfo.cspurl = getCSPUrl(itemName);
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

    // PRICE
    if (phase !== undefined) itemName = itemName + ' - ' + phase;

    // vanilla check
    if (!itemName.includes("|") && itemInfo.wear) {
        itemName =  itemName.replace(/\s*\([^)]*\)/, '');
    }

    itemInfo.cspurl = getCSPUrl(itemName)

    price_obj = prices[itemName];

    if (price_obj === undefined) {
        // console.log(`[PRICECHECK ERROR]: ${itemName}`);
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
    if (data.rollPrice == null) return;

    const showUsd = (typeof pricingUsdPriceShown !== 'undefined') ? pricingUsdPriceShown : true;
    if (!showUsd) return;

    const balance = node.querySelector('cw-pretty-balance');
    if (!balance) return;

    const rate = getRollUsdRate();
    const usd = data.rollPrice * rate;
    const label = document.createElement('span');
    label.className = 'rh-coin-usd';
    label.textContent = `≈ ${fmtUsd(usd)}`;
    label.title = `${data.rollPrice.toFixed(2)} coins × ${rate}`;

    // Place directly after the coin balance element so it sits underneath visually
    const host = balance.parentElement || balance;
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
    if (d > 0) return 'rh-pos';   // overpriced vs market = bad for buyer (red)
    return 'rh-neg';              // underpriced = good (green)
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

    // Top-left price stack
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

    // hide markups when inflated and toggle off — but keep liquidity / CSP link
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

    // Inflated badge sits inline next to the first market row
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