let version = `1.4.1`;

console.log(
    `%cROLLHELPER by CSPricebase.com %cversion ${version}`,
    `
    color: #eb0909;
    font-weight: bold;
    font-size: 20px;
  `,
    `
    color: #999;
    font-size: 12px;
    vertical-align: super;
  `
);

console.log(
    `%c[STEAM TOKEN UPDATER]: [ON]\n[ALWAYS-ON STORE]: [ON]\n[TRACKING DASHBOARD]: Visit cspricebase.com for tracking key`,
    `
    color: #008000;
    font-size: 13px;
    font-weight: bold;
  `
);


console.log(
    `%c Need premium / custom features? → Discord: maintrades `,
    `
    color: #ff8c00;
    font-size: 11px;
    font-weight: bold;
  `
);

let STEAM_OFFER_ERROR_PRIORITY = 0;
let emergencyAlerts;

let pi;
let rates;
let itemID;
let userID;
let steamId;
let balance;
let socket;
let itemsList = [];
let connected = false;
let reconnectAttempts = 0;
let messageQueue = [];
let messageQueueLocked = true;

const MAX_RECONNECT_ATTEMPTS = 20;
const RECONNECT_BASE_DELAY = 60_000;
const RECONNECT_MAX_DELAY = 85_000;

// Markup decay state
let decayTrackedTrades = {};
const DECAY_CHECK_INTERVAL = 60_000;
const CRAFT_MARKUP_THRESHOLD = 15;

async function loadDecayState() {
    const { markupDecayTrades = {} } =
        await chrome.storage.local.get(['markupDecayTrades']);
    decayTrackedTrades = markupDecayTrades;
}

async function saveDecayState() {
    await chrome.storage.local.set({
        markupDecayTrades: decayTrackedTrades,
    });
}

function getDecayType(markup) {
    return markup > CRAFT_MARKUP_THRESHOLD ? 'craft' : 'item';
}

function isDecayEnabledFor(type) {
    return type === 'craft' ? markupDecayEnabled : itemDecayEnabled;
}

function getDecaySettings(type) {
    if (type === 'craft') {
        return {
            amount: markupDecayAmount,
            intervalHours: markupDecayIntervalHours,
            floorPercent: markupDecayMinPercent,
        };
    }
    return {
        amount: itemDecayAmount,
        intervalHours: itemDecayIntervalHours,
        floorPercent: itemDecayMinPercent,
    };
}

function trackForMarkupDecay(trade) {
    const tradeItem = getTradeItem(trade);
    if (!tradeItem) return;

    const isOurDeposit = trade.depositor?.id === userID ||
        itemsList.some(i => i.steamExternalId === tradeItem.steamExternalAssetId);
    if (!isOurDeposit) return;
    const markup = tradeItem.markupPercent;
    if (markup <= 0) return;
    if (decayTrackedTrades[trade.id]) return;

    const steamExternalId = tradeItem.steamExternalAssetId;
    const decayType = getDecayType(markup);

    if (!isDecayEnabledFor(decayType)) return;

    decayTrackedTrades[trade.id] = {
        tradeId: trade.id,
        marketName: tradeItem.marketName,
        currentMarkup: markup,
        baseValue: tradeItem.itemVariant?.value,
        itemVariantId: tradeItem.itemVariant?.id,
        steamExternalAssetId: steamExternalId,
        lastDecayAt: new Date().toISOString(),
        iconUrl: tradeItem.itemVariant?.iconUrl || '',
        decayType: decayType,
    };

    saveDecayState();
    const label = decayType === 'craft' ? 'CRAFT-DECAY' : 'ITEM-DECAY';
    console.log(`%c${DateFormater(new Date())} | [${label}] Tracking ${tradeItem.marketName} at ${markup}%`, noticeCSSlog);
}

function untrackMarkupDecay(tradeId) {
    if (!decayTrackedTrades[tradeId]) return;
    delete decayTrackedTrades[tradeId];
    saveDecayState();
}

async function seedDecayFromListedTrades() {
    if (!markupDecayEnabled && !itemDecayEnabled) return;
    try {
        const listedTrades = await fetchUserListedTrades();
        if (!Array.isArray(listedTrades) || listedTrades.length === 0) {
            // No listed trades
            if (Object.keys(decayTrackedTrades).length > 0) {
                decayTrackedTrades = {};
                await saveDecayState();
            }
            return;
        }

        const listedIds = new Set(listedTrades.map(t => t.id));
        let pruned = 0;
        for (const tradeId of Object.keys(decayTrackedTrades)) {
            if (!listedIds.has(tradeId)) {
                delete decayTrackedTrades[tradeId];
                pruned++;
            }
        }
        if (pruned > 0) {
            console.log(`%c${DateFormater(new Date())} | [DECAY] Pruned ${pruned} stale entries from decay tracker`, noticeCSSlog);
        }

        let seeded = 0;
        for (const trade of listedTrades) {
            if (trade.status !== 'LISTED') continue;
            if (decayTrackedTrades[trade.id]) continue;
            trackForMarkupDecay(trade);
            if (decayTrackedTrades[trade.id]) seeded++;
        }

        if (seeded > 0) {
            console.log(`%c${DateFormater(new Date())} | [DECAY] Seeded ${seeded} existing listed deposits for decay tracking`, noticeCSSlog);
        }

        await saveDecayState();
    } catch (err) {
        console.log(`%c${DateFormater(new Date())} | [DECAY] Failed to seed listed trades: ${err.message}`, errorCSSlog);
    }
}

async function checkMarkupDecay() {
    if (!markupDecayEnabled && !itemDecayEnabled) return;
    if (Object.keys(decayTrackedTrades).length === 0) return;

    const now = Date.now();

    for (const [tradeId, data] of Object.entries({ ...decayTrackedTrades })) {
        const type = data.decayType || 'craft';
        if (!isDecayEnabledFor(type)) continue;

        const settings = getDecaySettings(type);
        const intervalMs = settings.intervalHours * 3600_000;
        const elapsed = now - new Date(data.lastDecayAt).getTime();
        const intervalsPassed = Math.floor(elapsed / intervalMs);

        if (intervalsPassed < 1) continue;

        // Already at or below floor
        if (data.currentMarkup <= settings.floorPercent) {
            decayTrackedTrades[tradeId].lastDecayAt = new Date().toISOString();
            await saveDecayState();
            continue;
        }

        const drop = intervalsPassed * settings.amount;
        const targetMarkup = Math.max(data.currentMarkup - drop, settings.floorPercent);

        console.log(`%c${DateFormater(new Date())} | [${type === 'craft' ? 'CRAFT-DECAY' : 'ITEM-DECAY'}] ${data.marketName}: ${data.currentMarkup}% -> ${targetMarkup}% (elapsed: ${(elapsed / 3600_000).toFixed(2)}h, intervals: ${intervalsPassed})`, noticeCSSlog);
        await performDecayRelist(tradeId, data, targetMarkup);
    }
}

async function retryWithBackoff(fn, label, maxRetries = 4) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt === maxRetries) throw err;
            const delay = (attempt + 1) * 5000;
            console.log(`%c${DateFormater(new Date())} | [${label}] Attempt ${attempt + 1} failed: ${err.message} — retrying in ${delay / 1000}s`, noticeCSSlog);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

async function performDecayRelist(tradeId, data, newMarkup) {
    const marketName = data.marketName;
    const label = data.decayType === 'craft' ? 'CRAFT-DECAY' : 'ITEM-DECAY';

    try {
        await retryWithBackoff(() => cancelCsgorollTrade(tradeId), label);
        console.log(`%c${DateFormater(new Date())} | [${label}] Cancelled ${marketName} (was ${data.currentMarkup}%)`, noticeCSSlog);

        delete decayTrackedTrades[tradeId];
        await saveDecayState();

        await new Promise(r => setTimeout(r, 3000));

        const invItem = itemsList.find(i => i.steamExternalId === data.steamExternalAssetId);
        if (!invItem) {
            console.log(`%c${DateFormater(new Date())} | [${label}] Item not found in inventory: ${marketName}`, errorCSSlog);
            sendPushoverNotification(`[${label} FAILED]: Item not in inventory\n${marketName}`, { priority: emergencyAlerts ? 2 : 1 });
            return;
        }

        const relistValue = data.baseValue * (1 + newMarkup / 100);
        const newTrade = await retryWithBackoff(() => relistDeposit(invItem.assetID, data.itemVariantId, relistValue), label);

        decayTrackedTrades[newTrade.id] = {
            ...data,
            tradeId: newTrade.id,
            currentMarkup: newMarkup,
            lastDecayAt: new Date().toISOString(),
        };
        await saveDecayState();

        console.log(`%c${DateFormater(new Date())} | [${label}] ${marketName} relisted: ${data.currentMarkup}% -> ${newMarkup}% (${relistValue.toFixed(2)} coins)`, steamOfferCSSlog);

        if (depoAlert) {
            notifyPushover(`[${label}]: ${marketName}\n${data.currentMarkup}% -> ${newMarkup}%\n${relistValue.toFixed(2)} coins`, 0);
        }
    } catch (err) {
        console.log(`%c${DateFormater(new Date())} | [${label} ERROR] ${marketName}: ${err.message}`, errorCSSlog);
        sendPushoverNotification(`[${label} FAILED]: ${marketName}\n${err.message}`, { priority: emergencyAlerts ? 2 : 1 });
    }
}

let steam_access_token;
let token_expiration;
let token_steam_update_errors = 0;
let TOKEN_STEAM_MAX_ERRORS = 5;
let TOKEN_STEAM_MAX_ENABLED = true;


setInterval(async() => {
    try {
        await getUserID();
    } catch (e) {
        console.log(`[STEAM TOKEN CHECK]: getUserID failed: ${e.message}`);
        return;
    }

    let now = new Date();
    const expiryDate = token_expiration ? new Date(token_expiration) : null;

    if (TOKEN_STEAM_MAX_ENABLED === false) return;
    if (token_steam_update_errors > TOKEN_STEAM_MAX_ERRORS) {
        TOKEN_STEAM_MAX_ENABLED = false;
        sendPushoverNotification(`[STEAM_TOKEN_UPDATER]\nThe automatic steam token updater has been disabled due to errors.`, {
            priority: emergencyAlerts ? 2 : 0
        });
    };

    if ((steam_access_token == null) || (token_expiration == null) || (now > expiryDate)) {
        console.log(`[STEAM TOKEN]: Expired or missing, updating...`);
        await updateAccessToken();
    } else {
        const timeRemaining = expiryDate - now;
        const hoursRemaining = (timeRemaining / (1000 * 60 * 60)).toFixed(2);
        const minutesRemaining = (timeRemaining / (1000 * 60)).toFixed(2);
    }
}, 70_000);


const SteamTokenCheck = async () => {
    let now = new Date();
    if ((steam_access_token == null) || (token_expiration == null) || (now > new Date(token_expiration))) {
        await updateAccessToken();
    } else{
        const timeRemaining = new Date(token_expiration) - now;
        const hoursRemaining = (timeRemaining / (1000 * 60 * 60)).toFixed(2);
        const minutesRemaining = (timeRemaining / (1000 * 60)).toFixed(2);
    }
}

const trackTrade = (trade, status, side) => {
    if (!wantTracking) return;

    try {
        chrome.runtime.sendMessage({
            type: 'track_trade',
            payload: {
                tradeId: trade.id,
                status: status,
                side: side,
                coinValue: trade.tradeItems?.[0]?.value || 0,
                markup: trade.tradeItems?.[0]?.markupPercent,
                rawTrade: trade,
            }
        }, () => {
            if (chrome.runtime.lastError) { /* tracker may not be ready */ }
        });
    } catch (e) {
    }
};

function getTradeItem(trade) {
    return trade.tradeItems?.[0] || null;
}

function getFloatStr(trade) {
    const range = trade.avgPaintWearRange;
    return range ? `${range.min} – ${range.max}` : 'N/A';
}

function calcMaxMarkup(tradeItem) {
    if (!tradeItem) return 12;
    const stickersArr = tradeItem.stickers || [];
    const basePrice = tradeItem.itemVariant?.value || 0;
    if (stickersArr.length === 0) return 12;

    let addedStickersValue = 0;
    for (const sticker of stickersArr) {
        addedStickersValue += sticker.wear == 0
            ? sticker.value / 5
            : sticker.value / 20;
    }
    return evalMaxMarkup(basePrice, addedStickersValue);
}

function buildTradeInfo(trade, tradeItem, event) {
    const marketName = tradeItem.marketName;
    const value = tradeItem.value;
    const markup = tradeItem.markupPercent;
    const maxMarkup = calcMaxMarkup(tradeItem);
    const floatStr = getFloatStr(trade);
    const pricing_data = getPriceDataForLogs(marketName, value, event) || {};

    return {
        marketname: marketName,
        value: value,
        markup: markup,
        maxMarkup: maxMarkup,
        float: floatStr,
        liquidity: pricing_data.liquidity || '-',
        coins_usd: pricing_data.rollUSD || '-',
        buff163: pricing_data.buff_usd || '-',
        buff_percent: pricing_data.buffDelta || '-',
        csf_percent: pricing_data.csfDelta || '-',
        uu_percent: pricing_data.uuDelta || '-',
        csp_url: pricing_data.cspurl || '',
        rate: pricing_data.rate || 0.66,
        iconUrl: tradeItem.itemVariant?.iconUrl || '',
    };
}

function formatPricingLog(info) {
    const bp = info.buff_percent;
    const cp = info.csf_percent;
    const up = info.uu_percent;
    return `${info.value} coins | (${info.markup}%) | ${info.coins_usd}$` +
        `\n[LIQ]: ${info.liquidity}% | [MAX MARKUP]: ${info.maxMarkup}%` +
        `\n[BUFF163]: ${bp >= 0 ? "+" : ""}${bp}%` +
        `\n[CSFLOAT]: ${cp >= 0 ? "+" : ""}${cp}%` +
        `\n[YOUPIN]: ${up >= 0 ? "+" : ""}${up}% (RATE: ${info.rate})`;
}

function notifyPushover(message, priority) {
    if (Pushover) sendPushoverNotification(message, { priority: Number(priority) });
}

function notifyDiscord(webhookType, trade_info) {
    if (discord) sendWebHookDiscord(Webhook, webhookType, trade_info);
}

function getTradeSide(trade) {
    if (!trade.depositor) return 'deposit';
    return trade.depositor.id === userID ? 'deposit' : 'withdrawal';
}

// MSG LISTENERS
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'ping_ws' && msg.userid === userID && connected) {
        sendResponse(true);
    } else {
        sendResponse(false);
    }
    return true;
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PRICES_UPDATED') {
        console.log(
            `%c[CS:PRICEBASE] -> Successfully refreshed current price data`,
            cspApiCSSlog,
        );
        prices = msg.data;
    }
});

const getActiveRollUrls = () => {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'getActiveRollUrls' }, response => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
};

const fetchRates = async () => {
    const ratesURL = chrome.runtime.getURL('assets/rates/rates.json');
    fetch(ratesURL)
        .then(response => response.json())
        .then(data => {
            rates = data;
            return rates;
        })
        .catch(error => {
            console.log(error);
            console.log(
                `%c[ROLLHELPER - ERROR] - Could not load the pricing rates file (rates.json)`,
                errorCSSlog,
            );
        });
};

const askForOpenWs = userID => {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { type: 'open_ws', userid: userID },
            response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            },
        );
    });
};

const initRollhelper = async () => {
    itemInfo = {};
    prices = {};
    rates = {};

    try {
        const response = await getActiveRollUrls();
        let currentUrl = response[0];
        domainUrl = createApiUrl(currentUrl);
        await getUserID();
        await SteamTokenCheck();
        rates = await fetchRates();
        await getCurrentSteamInvData(userID);
        await updateSettings();
        await loadDecayState();
        await seedDecayFromListedTrades();
        setInterval(checkMarkupDecay, DECAY_CHECK_INTERVAL);
        prices = await loadCSP();
        await initConnection();
    } catch (error) {
        console.error('Error at initRollhelper:', error);
    }
};

const initConnection = async () => {
    let allowConnect = await askForOpenWs(userID);
    if (allowConnect) {
        applyPromo();
        setInterval(processMessageQueue, 1000)
        connectWSS();
    } else {
        setTimeout(initConnection, 12_000);
    }
};

function processMessageQueue() {
    if (messageQueue.length === 0) return;
    if (socket.readyState !== WebSocket.OPEN) return;
    if (messageQueueLocked) return;
    const message = messageQueue.shift();
    socket.send(message);
}

function enqueueMessage(message) {
    messageQueue.push(message);
}

function sp() {
    try {
        if (socket.readyState == WebSocket.OPEN){
            socket.send(JSON.stringify({ type: "ping" }))
        }
    } catch (e) {
        console.log(e);
    }
}

// WS CONNECTION
function connectWSS() {
    if (socket != null) {
        try {
            socket.close();
        } catch (e) {
            console.log(e);
        }
    }

    socket = new WebSocket(
        'wss://router.csgoroll.com/ws',
        'graphql-transport-ws',
    );

    socket.onopen = () => {
        connected = true;
        reconnectAttempts = 0;
        setTimeout(
            () =>
                socket.send(
                    JSON.stringify({ type: "ping", payload: {} })
                ),
            50
        );

        setTimeout(
            () =>
                socket.send(JSON.stringify({ type: "connection_init" })),
            150
        );

        setTimeout(() => {
            enqueueMessage(JSON.stringify(updateTradePayload))
            enqueueMessage(JSON.stringify(createTradePayload))
        }, 2500);

        setTimeout(() => {
            if (socket.readyState == WebSocket.OPEN)
                messageQueueLocked = false;
        }, 3500);

        pI = setInterval(sp, 30_000);
    };

    socket.onmessage = async (event) => {
        let data = JSON.parse(event.data);

        if (data?.type === 'connection_ack') {
            console.log(
                `%c${DateFormater(new Date())} | [ROLLHELPER - CONNECTED]`,
                noticeCSSlog,
            );
            return;
        }

        if (data?.payload?.data?.createTrades) {
            const trades = data.payload.data.createTrades.trades;
            if (trades) {
                for (const trade of trades) {
                    if (trade.status === 'LISTED') {
                        trackForMarkupDecay(trade);
                    }
                }
            }
            return;
        }

        if (!data?.payload?.data?.updateTrade) return;

        const trade = data.payload.data.updateTrade.trade;
        if (!trade) return;

        const status = trade.status;
        const side = getTradeSide(trade);

        // Markup decay tracking for our deposits
        if (status === 'LISTED') {
            trackForMarkupDecay(trade);
        } else {
            untrackMarkupDecay(trade.id);
        }

        if (!trade.withdrawer) return;

        const tradeItem = getTradeItem(trade);
        trackTrade(trade, status, side);

        switch (status) {

            case 'JOINED':
                handleJoined(trade, side, tradeItem, data);
                break;

            case 'PROCESSING':
                handleProcessing(trade, side, tradeItem, data);
                break;

            case 'COMPLETED':
                handleCompleted(trade, side, tradeItem);
                break;

            case 'COMPLETED_PROTECTED':
                handleCompletedProtected(trade, side, tradeItem);
                break;

            case 'COOLDOWN':
                handleCooldown(trade, side, tradeItem);
                break;

            case 'CANCELLED':
                handleCancelled(trade, side, tradeItem);
                break;

            case 'EXPIRED':
                handleExpired(trade, side, tradeItem);
                break;

            default:
                console.log(
                    `%c${DateFormater(new Date())} | [TRADE - ${status}] ${tradeItem?.marketName || 'Unknown'}`,
                    noticeCSSlog,
                );
                break;
        }
    };

    socket.onerror = (error) => {
        messageQueueLocked = true;
        if (pi)  clearInterval(pI);

        console.error('WebSocket error:', error);
    };

    socket.onclose = (event) => {
        messageQueueLocked = true;
        if (pi) clearInterval(pI);

        console.log(`WebSocket closed with code: ${event.code}, reason: ${event.reason}`);
        connected = false;

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(
                RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts),
                RECONNECT_MAX_DELAY
            );

            console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

            setTimeout(() => {
                reconnectAttempts++;
                connectWSS();
            }, delay);
        } else {
            console.error('Maximum reconnection attempts reached. Connection failed.');
        }
    };
}

// DEPOSIT SAFEGUARD
function checkDepositSafeguard(tradeItem) {
    if (!depositSafeguard || !prices) return null;

    const baseValue = tradeItem.itemVariant?.value;
    if (!baseValue) return null;

    let lookupName = tradeItem.marketName;
    if (isDoppler(lookupName)) lookupName = refactorDopplerNameForPE(lookupName);

    const priceObj = prices[lookupName];
    if (!priceObj) return null;

    const rate = 0.66;
    const candidates = {};

    if (priceObj.price_buff != null) candidates.buff = priceObj.price_buff / 100;
    if (priceObj.price_csfloat != null) candidates.csfloat = priceObj.price_csfloat / 100;
    if (priceObj.price_uu != null) candidates.youpin = priceObj.price_uu / 100;

    let marketUsd = null;
    let marketLabel = safeguardMarket;

    if (safeguardMarket === 'lowest') {
        const vals = Object.entries(candidates).filter(([, v]) => v > 0);
        if (vals.length > 0) {
            const [label, price] = vals.reduce((a, b) => a[1] < b[1] ? a : b);
            marketUsd = price;
            marketLabel = label;
        }
    } else {
        marketUsd = candidates[safeguardMarket] || null;
    }

    if (!marketUsd || marketUsd <= 0) return null;

    const rollUsd = baseValue * rate;
    const delta = ((rollUsd / marketUsd) - 1) * 100;

    if (delta < -safeguardThreshold) {
        return {
            delta: Number(delta.toFixed(1)),
            market: marketLabel,
            marketUsd: Number(marketUsd.toFixed(2)),
            rollUsd: Number(rollUsd.toFixed(2)),
        };
    }

    return null;
}

// EVENT HANDLERS
function handleJoined(trade, side, tradeItem, data) {
    if (!tradeItem) return;
    const marketName = tradeItem.marketName;
    const value = tradeItem.value;
    const markup = tradeItem.markupPercent;

    if (side === 'deposit') {
        const safeguardHit = checkDepositSafeguard(tradeItem);

        if (safeguardHit) {
            const sgLog = `[SAFEGUARD BLOCKED]\n${marketName}\nBase: $${safeguardHit.rollUsd} | ${safeguardHit.market}: $${safeguardHit.marketUsd} (${safeguardHit.delta}%)`;
            console.log(`%c${DateFormater(new Date())} | ${sgLog}`, errorCSSlog);

            notifyPushover(`[SAFEGUARD BLOCKED]: ${marketName}\nCSGORoll: $${safeguardHit.rollUsd} vs ${safeguardHit.market}: $${safeguardHit.marketUsd}\nDelta: ${safeguardHit.delta}%\nAuto-accept skipped!`, {
                priority: emergencyAlerts ? 2 : 1
            });
            notifyDiscord('SafeguardBlocked', {
                marketname: marketName,
                value: value,
                markup: markup,
                iconUrl: tradeItem.itemVariant?.iconUrl || '',
            });
        } else if (depoAutoAccept) {
            retryWithBackoff(() => fetchAcceptTrade(trade.id), 'ACCEPT-TRADE');
        }

        const info = buildTradeInfo(trade, tradeItem, 'deposit');
        info.withdrawer_name = trade.withdrawer?.displayName;
        info.withdrawer_id = trade.withdrawer?.id;

        const log_string = `[DEPOSIT]\n${marketName}\n${formatPricingLog(info)}`;
        console.log(`%c${DateFormater(new Date())} | ${log_string}`, depositCSSlog);
        console.log("%cCS:PRICEBASE - COMPARATOR ➡ (LIVE PRICES)", cspCSSlog, info.csp_url);

        if (depoAlert) {
            notifyPushover(log_string, depositNotifPriority);
            notifyDiscord('areYouReady', info);
        }

    } else {
        const info = buildTradeInfo(trade, tradeItem, 'other');

        const log_string = `[WITHDRAW - WAITING]\n${marketName}\n${formatPricingLog(info)}`;
        console.log(`%c${DateFormater(new Date())} | ${log_string}`, noticeCSSlog);
    }
}

function handleProcessing(trade, side, tradeItem, data) {
    if (!tradeItem) return;
    const marketName = tradeItem.marketName;

    if (side === 'deposit') {
        // We are the depositor, send Steam offer if enabled
        if (sendSteamOffers) {
            const itemID = tradeItem.itemVariant?.itemId;
            const tradeLink = data.payload.data.updateTrade.trade.withdrawerSteamTradeUrl;
            const externalSteamId = data.payload.data.updateTrade.trade.tradeItems[0]?.steamExternalAssetId;

            let found = false;
            for (const item of itemsList) {
                if (item.itemID === itemID && item.steamExternalId === externalSteamId) {
                    retryWithBackoff(() => sendSteamTradeOffer(item.assetID, tradeLink, offerMessage), 'STEAM-OFFER')
                        .then(steamOfferId => {
                            console.log(`%c${DateFormater(new Date())} | [ROLLHELPER - Steam offer sent] (offerid: ${steamOfferId})`, steamOfferCSSlog);
                            savePendingOffer(trade.id, steamOfferId);
                        })
                        .catch(err => {
                            console.log(`%c${DateFormater(new Date())} | [ROLLHELPER - Steam offer send failed: ${err.message}]`, errorCSSlog);
                            sendPushoverNotification(`[STEAM-OFFER-ERROR]: Failed to send offer\n${marketName}\n${err.message}`, {
                                priority: emergencyAlerts ? 2 : STEAM_OFFER_ERROR_PRIORITY
                            });
                        });
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.log(`%c${DateFormater(new Date())} | [ROLLHELPER - Steam offer error (item not found)]`, errorCSSlog);
                sendPushoverNotification(`[STEAM-OFFER-ERROR]: Item has not been sent (not found)\n ${marketName}`, {
                    priority: emergencyAlerts ? 2 : STEAM_OFFER_ERROR_PRIORITY
                });
            }
        }

    } else {
        const info = buildTradeInfo(trade, tradeItem, 'deposit');

        const log_string = `[WITHDRAW - ACCEPTED]\n${marketName}\n${formatPricingLog(info)}`;
        console.log(`%c${DateFormater(new Date())} | ${log_string}`, withdrawAcceptedCSSlog);
        console.log("%cCS:PRICEBASE - COMPARATOR ➡ (LIVE PRICES)", cspCSSlog, info.csp_url);

        if (withdrawAlert) {
            notifyPushover(log_string, withdrawNotifPriority);
            notifyDiscord('IncommingTrade', info);
        }
    }
}

function handleCompleted(trade, side, tradeItem) {
    if (!tradeItem) return;
    const marketName = tradeItem.marketName;
    const info = buildTradeInfo(trade, tradeItem, 'other');

    const log_string = `[TRADE - COMPLETED]\n\t${marketName}\n\t${formatPricingLog(info)}`;
    console.log(`%c${DateFormater(new Date())} | ${log_string}`, tradeCompletedCSSlog);

    if (depoAlert && completedAlert) {
        notifyPushover(log_string, completedNotifPriority);
        notifyDiscord('TradeCompleted', info);
    }

    removePendingOffer(trade.id);
}

function handleCompletedProtected(trade, side, tradeItem) {
    if (!tradeItem) return;
    if (side !== 'deposit') return;
    const marketName = tradeItem.marketName;
    const info = buildTradeInfo(trade, tradeItem, 'other');

    const log_string = `[DEPOSIT_COMPLETED_PROTECTED]\n${marketName}\n${formatPricingLog(info)}`;
    console.log(`%c${DateFormater(new Date())} | ${log_string}`, depositCSSlog);
    console.log("%cCS:PRICEBASE - COMPARATOR ➡ (LIVE PRICES)", cspCSSlog, info.csp_url);

    if (depoAlert) {
        notifyPushover(log_string, protectedNotifPriority);
        notifyDiscord('protectedDeposit', info);
    }

    removePendingOffer(trade.id);
}

const COOLDOWN_RELIST_DELAY = 45 * 60 * 1000; // 45min

function scheduleRelistAfterCooldown(trade, tradeItem) {
    if (!autoRelist) return;
    const marketName = tradeItem?.marketName || 'Unknown';
    const delayMin = (COOLDOWN_RELIST_DELAY / 60000).toFixed(0);

    console.log(`%c${DateFormater(new Date())} | [AUTO-RELIST] ${marketName} scheduled for relist in ${delayMin}m (after cooldown)`, noticeCSSlog);

    if (depoAlert) {
        notifyPushover(`[AUTO-RELIST SCHEDULED]: ${marketName}\nWill relist in ${delayMin} minutes (cooldown)`, 0);
    }

    setTimeout(() => {
        autoRelistDeposit(trade, tradeItem, 'COOLDOWN');
    }, COOLDOWN_RELIST_DELAY);
}

async function autoRelistDeposit(trade, tradeItem, reason) {
    if (!autoRelist) return;
    if (!tradeItem) return;

    const marketName = tradeItem.marketName;
    const steamExternalId = tradeItem.steamExternalAssetId;
    const itemVariantId = tradeItem.itemVariant?.id;
    const baseValue = tradeItem.itemVariant?.value;
    const markup = tradeItem.markupPercent;

    if (!itemVariantId || !baseValue) {
        console.log(`%c${DateFormater(new Date())} | [AUTO-RELIST] Missing item data for ${marketName}`, errorCSSlog);
        return;
    }

    const invItem = itemsList.find(i => i.steamExternalId === steamExternalId);
    if (!invItem) {
        console.log(`%c${DateFormater(new Date())} | [AUTO-RELIST] Item not found in inventory: ${marketName}`, errorCSSlog);
        sendPushoverNotification(`[AUTO-RELIST FAILED]: Item not in inventory\n${marketName}`, {
            priority: emergencyAlerts ? 2 : 0
        });
        return;
    }

    const relistValue = baseValue * (1 + markup / 100);

    try {
        const newTrade = await retryWithBackoff(() => relistDeposit(invItem.assetID, itemVariantId, relistValue), 'AUTO-RELIST');
        console.log(`%c${DateFormater(new Date())} | [AUTO-RELIST] ${marketName} relisted at ${markup}% markup (${relistValue.toFixed(2)} coins) [reason: ${reason}]`, steamOfferCSSlog);

        if (depoAlert) {
            notifyPushover(`[AUTO-RELIST]: ${marketName}\n${relistValue.toFixed(2)} coins (${markup}%)\nReason: ${reason}`, 0);
            notifyDiscord('TradeRelisted', {
                marketname: marketName,
                value: relistValue,
                markup: markup,
                iconUrl: tradeItem.itemVariant?.iconUrl || '',
            });
        }
    } catch (err) {
        console.log(`%c${DateFormater(new Date())} | [AUTO-RELIST ERROR] ${marketName}: ${err.message}`, errorCSSlog);
        sendPushoverNotification(`[AUTO-RELIST FAILED]: ${marketName}\n${err.message}`, {
            priority: emergencyAlerts ? 2 : 1
        });
    }
}

async function autoCancelPendingSteamOffer(trade, marketName) {
    if (!autoCancelOffers) return;
    const steamOfferId = await removePendingOffer(trade.id);
    if (!steamOfferId) return;

    try {
        await retryWithBackoff(() => cancelSteamTradeOffer(steamOfferId), 'AUTO-CANCEL');
        console.log(`%c${DateFormater(new Date())} | [AUTO-CANCEL] Steam offer ${steamOfferId} cancelled for ${marketName}`, steamOfferCSSlog);
        sendPushoverNotification(`[AUTO-CANCEL]: Steam offer cancelled\n${marketName}\nOffer ID: ${steamOfferId}`);
    } catch (err) {
        const alreadyInactive = err.message.includes('status 500') || err.message.includes('"success"');
        if (alreadyInactive) {
            console.log(`%c${DateFormater(new Date())} | [AUTO-CANCEL] Offer ${steamOfferId} already inactive for ${marketName}`, noticeCSSlog);
        } else {
            console.log(`%c${DateFormater(new Date())} | [AUTO-CANCEL ERROR] Failed to cancel offer ${steamOfferId}: ${err.message}`, errorCSSlog);
            sendPushoverNotification(`[AUTO-CANCEL-ERROR]: Failed to cancel steam offer\n${marketName}\n${err.message}`, {
                priority: emergencyAlerts ? 2 : 1
            });
        }
    }
}

function handleCooldown(trade, side, tradeItem) {
    if (!tradeItem) return;
    const marketName = tradeItem.marketName;
    const value = tradeItem.value;
    const markup = tradeItem.markupPercent;

    const log_string = `[TRADE - COOLDOWN]\n${marketName}\n${value} coins | (${markup}%)`;
    console.log(`%c${DateFormater(new Date())} | ${log_string}`, errorCSSlog);

    if (depoAlert && cooldownAlert) {
        notifyPushover(log_string, cooldownNotifPriority);
        notifyDiscord('TradeCooldown', {
            marketname: marketName,
            value: value,
            markup: markup,
            iconUrl: tradeItem.itemVariant?.iconUrl || '',
        });
    }

    autoCancelPendingSteamOffer(trade, marketName);
    if (side === 'deposit') scheduleRelistAfterCooldown(trade, tradeItem);
}

function handleCancelled(trade, side, tradeItem) {
    const marketName = tradeItem?.marketName || 'Unknown';
    const value = tradeItem?.value || 0;
    const markup = tradeItem?.markupPercent || 0;

    const log_string = `[TRADE - CANCELLED]\n${marketName}\n${value} coins | (${markup}%)`;
    console.log(`%c${DateFormater(new Date())} | ${log_string}`, errorCSSlog);

    autoCancelPendingSteamOffer(trade, marketName);
    if (side === 'deposit' && trade.cancelReason !== 'USER_CANCELLED') {
        autoRelistDeposit(trade, tradeItem, 'CANCELLED');
    }
}

function handleExpired(trade, side, tradeItem) {
    const marketName = tradeItem?.marketName || 'Unknown';
    const value = tradeItem?.value || 0;
    const markup = tradeItem?.markupPercent || 0;

    const log_string = `[TRADE - EXPIRED]\n${marketName}\n${value} coins | (${markup}%)`;
    console.log(`%c${DateFormater(new Date())} | ${log_string}`, errorCSSlog);

    autoCancelPendingSteamOffer(trade, marketName);
    if (side === 'deposit') autoRelistDeposit(trade, tradeItem, 'EXPIRED');
}

function disconnect() {
    if (socket) {
        socket.onclose = null;
        socket.close();
        socket = null;
        connected = false;
        console.log('[ROLLHELPER]: WebSocket disconnected');
    }
}

initRollhelper()