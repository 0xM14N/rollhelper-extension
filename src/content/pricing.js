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
    document.querySelectorAll('.buff-overlay, .marketname-overlay').forEach(el => el.remove());
    document.querySelectorAll('cw-csgo-market-item-card[data-pricing-injected]').forEach(node => {
        delete node.dataset.pricingInjected;
    });
}

function showAllOverlays() {
    processExistingCards();
}

let lastPricingState = enablePricing;
setInterval(() => {
    if (enablePricing !== lastPricingState) {
        lastPricingState = enablePricing;

        if (enablePricing) {
            // console.log('[RollHelper] Pricing enabled');
            initializePricing();
            showAllOverlays();
        } else {
            // console.log('[RollHelper] Pricing disabled');
            removeAllOverlays();
        }
    }
}, 100);

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

    // buff163
    let realBuffVal = buff_usd / rate;
    let buffVal = Math.floor(realBuffVal * 100) / 100;
    const buffDelta = calcDelta(rollPrice, buff_usd, rate);

    // csfloat
    let realCSFVal = csf_usd / rate;
    let csfVal = Math.floor(realCSFVal * 100) / 100;
    const csfDelta  = calcDelta(rollPrice, csf_usd, rate);

    // uu delta
    let realUUVal = uu_usd / rate;
    let uuVal = Math.floor(realUUVal * 100) / 100;
    let uuDelta  = calcDelta(rollPrice, uu_usd, rate);

    if (isDoppler(itemName)) {
        uuDelta = null;
    }

    itemInfo.marketname = itemName;
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

    ensurePositioned(node);

    const { overlay, heading_overlay } = createOverlay(data);

    if (heading_overlay) node.appendChild(heading_overlay);

    node.appendChild(overlay);
}

function calcDelta(sitePrice, marketUsd, rate) {
    if (!marketUsd || !rate || marketUsd <= 0) return null;

    const marketCoins = marketUsd / rate;
    const delta = (sitePrice / marketCoins - 1) * 100;

    return Number(delta.toFixed(1));
}

function createOverlay(data) {
    const overlay = document.createElement('div');
    overlay.className = 'buff-overlay';

    const heading_overlay = document.createElement("div");
    heading_overlay.className = 'marketname-overlay';

    heading_overlay.style.cursor = 'pointer';
    heading_overlay.title = 'Click to copy';
    heading_overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(data.marketname);
    });

    heading_overlay.innerHTML = `
        <div class="heading-overlay">
            copy
        </div>
    `;

    // Handle case where prices aren't loaded yet
    if (data.noPrices) {
        overlay.innerHTML = `
        <div class="rollhelper-container">
            <div class="rollhelper-logo"></div>
            <div class="price-column">
                <div class="row delta loading"></div>
            </div>
            <div class="liq-column">
                <div class="row liq">-</div>
            </div>
        </div>
        `;

        const img = document.createElement("img");
        img.src = chrome.runtime.getURL("assets/ico/csp.png");
        img.alt = "cs:pricebase";
        img.width = 30;
        img.height = 30;
        img.title = "View on CS:Pricebase"

        const link = document.createElement("a");
        link.href = data.cspurl;
        link.target = "_blank";
        link.appendChild(img);

        img.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        overlay.querySelector(".rollhelper-logo").appendChild(link);

        return { overlay, heading_overlay };
    }

    if (data.error) {
        overlay.innerHTML = `
        <div class="rollhelper-container">
            <div class="rollhelper-logo"></div>
            <div class="price-column">
                <div class="row delta buff neg">ERROR</div>
            </div>
            <div class="liq-column">
                <div class="row liq">-</div>
            </div>
        </div>
        `;

        const img = document.createElement("img");
        img.src = chrome.runtime.getURL("assets/ico/csp.png");
        img.alt = "cs:pricebase";
        img.width = 35;
        img.height = 35;
        img.title = "View on CS:Pricebase"

        const link = document.createElement("a");
        link.href = data.cspurl;
        link.target = "_blank";
        link.appendChild(img);

        img.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        overlay.querySelector(".rollhelper-logo").appendChild(link);

        return { overlay, heading_overlay };
    }

    // main layout
    overlay.innerHTML = `
        <div class="rollhelper-container">
            <div class="rollhelper-logo"></div>
            <div class="price-column">
                <div class="row delta buff ${data.buffDelta < 0 ? 'neg' : 'pos'}">
                    BUFF163: ${data.buffDelta > 0.5 ? `+${data.buffDelta}` : `${data.buffDelta}`}%
                </div>
                <div class="row delta csf ${data.csfDelta < 0 ? 'neg' : 'pos'}">
                    CSFLOAT: ${data.csfDelta > 0.5 ? `+${data.csfDelta}` : `${data.csfDelta}`}%
                </div>
                <div class="row delta csf ${data.uuDelta < 0 ? 'neg' : 'pos'}">
                    YOUPIN: ${data.uuDelta > 0.5 ? `+${data.uuDelta}` : `${data.uuDelta}`}%
                </div>
            </div>
            <div class="liq-column">
                <div class="row liq">LIQ: ${data.liquidity}%</div>
            </div>
        </div>
    `;

    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("assets/ico/csp.png");
    img.alt = "cs:pricebase";
    img.width = 35;
    img.height = 35;

    const link = document.createElement("a");
    link.href = data.cspurl;
    link.target = "_blank";
    link.appendChild(img);

    img.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    overlay.querySelector(".rollhelper-logo").appendChild(link);

    return { overlay, heading_overlay };
}

function injectStyles() {
    if (document.getElementById('rollhelper-extension-styles')) return;

    const style = document.createElement('style');
    style.id = 'rollhelper-extension-styles';

    style.textContent = `
    /* === RollHelper Overlay Layout === */
    
    .rollhelper-container {
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }
    
    /* Top left - Price column */
    .price-column {
        position: absolute;
        top: 6px;
        left: 6px;
        
        display: grid;
        row-gap: 2px;
        justify-items: flex-start;
        text-align: left;
        
        background-color: rgba(0, 0, 0, 0.6);
        border-radius: 8px;
        padding: 2px 5px;
        pointer-events: auto;
    }
    
    /* Middle bottom - Liquidity */
    .liq-column {
        position: absolute;
        left: 50%;
        bottom: 2px;
        transform: translateX(-50%);
        
        display: flex;
        align-items: center;
        font-size: 10px;
        
        background-color: rgba(0, 0, 0, 0.7);
        border-radius: 8px;
        padding: 1px 3px;
        pointer-events: auto;
    }
    
    /* Bottom right - Logo */
    .rollhelper-logo {
        position: absolute;
        bottom: 3px;
        right: 3px;
        
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
    }
    
    /* Icon styling */
    .rollhelper-logo img {
        display: block;
        border-radius: 4px;
        transition: transform 0.15s ease, opacity 0.15s ease;
    }
    
    .rollhelper-logo a:hover img {
        transform: scale(1.1);
        opacity: 0.9;
    }
    
    /* === Heading Overlay (Copy button) - Top right === */
    
    .heading-overlay {
        position: absolute;
        top: 6px;
        right: 6px;
        z-index: 999;
        pointer-events: auto;
        cursor: pointer;
        
        font-size: 10px;
        font-weight: bold;
        text-align: center;
        
        background: rgba(0, 0, 0, 0.7);
        border-radius: 8px;
        padding: 1px 3px;
    }
    
    /* === Top Overlay === */
    
    .buff-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999;
        pointer-events: none;
        
        font-size: 11px;
        line-height: 1.2;
    }
    
    /* Rows */
    
    .buff-overlay .row {
        white-space: nowrap;
        text-shadow: 
            -1px -1px 2px rgba(0,0,0,0.8),
            1px -1px 2px rgba(0,0,0,0.8),
            -1px 1px 2px rgba(0,0,0,0.8),
            1px 1px 2px rgba(0,0,0,0.8);
    }
    
    /* Colors */
    
    .buff-overlay .pos {
        color: #ff5c5c;
    }
    
    .buff-overlay .neg {
        color: #3bd671;
    }
    
    .buff-overlay .liq {
        color: #00d9ff;
    }
    
    .buff-overlay .loading {
        color: #ffeb3b;
        font-style: italic;
    }
`;
    document.head.appendChild(style);
}