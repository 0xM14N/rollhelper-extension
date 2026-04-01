let version = `1.3`;

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

let pi;
let rates;
let itemID;
let userID;
let balance;
let socket;
let itemsList = [];
let connected = false;
let reconnectAttempts = 0;
let messageQueue = [];
let messageQueueLocked = true;

const MAX_RECONNECT_ATTEMPTS = 20;
const RECONNECT_BASE_DELAY = 60_000;
const RECONNECT_MAX_DELAY = 82_000;

let steam_access_token;
let token_expiration;
let token_steam_update_errors = 0;
let TOKEN_STEAM_MAX_ERRORS = 5;
let TOKEN_STEAM_MAX_ENABLED = true;


setInterval(async() => {
    await getUserID();

    let now = new Date();
    const expiryDate = token_expiration ? new Date(token_expiration) : null;

    if (TOKEN_STEAM_MAX_ENABLED === false) return;
    if (token_steam_update_errors > TOKEN_STEAM_MAX_ERRORS) {
        TOKEN_STEAM_MAX_ENABLED = false;
        sendPushoverNotification(`[STEAM_TOKEN_UPDATER]\nThe automatic steam token updater has been disabled due to errors.`, {
            priority:2
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

        if (!data?.payload?.data?.updateTrade) return;

        const trade = data.payload.data.updateTrade.trade;
        if (!trade || !trade.withdrawer) return;

        const status = trade.status;
        const side = getTradeSide(trade);
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
        setTimeout(connectWSS, 62000);
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

// EVENT HANDLERS
function handleJoined(trade, side, tradeItem, data) {
    if (!tradeItem) return;
    const marketName = tradeItem.marketName;
    const value = tradeItem.value;
    const markup = tradeItem.markupPercent;

    if (side === 'deposit') {
        if (depoAutoAccept) {
            fetchAcceptTrade(trade.id);
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
        // We are the depositor — send Steam offer if enabled
        if (sendSteamOffers) {
            const itemID = tradeItem.itemVariant?.itemId;
            const tradeLink = data.payload.data.updateTrade.trade.withdrawerSteamTradeUrl;
            const externalSteamId = data.payload.data.updateTrade.trade.tradeItems[0]?.steamExternalAssetId;

            let found = false;
            for (const item of itemsList) {
                if (item.itemID === itemID && item.steamExternalId === externalSteamId) {
                    sendSteamTradeOffer(item.assetID, tradeLink, offerMessage);
                    console.log(`%c${DateFormater(new Date())} | [ROLLHELPER - Steam offer sent]`, steamOfferCSSlog);
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.log(`%c${DateFormater(new Date())} | [ROLLHELPER - Steam offer error (item not found)]`, errorCSSlog);
                sendPushoverNotification(`[STEAM-OFFER-ERROR]: Item has not been sent (not found)\n ${marketName}`, {
                    priority: STEAM_OFFER_ERROR_PRIORITY
                });
            }
        }

    } else {
        // We are the withdrawer — trade accepted by depositor
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
}

function handleCancelled(trade, side, tradeItem) {
    const marketName = tradeItem?.marketName || 'Unknown';
    const value = tradeItem?.value || 0;
    const markup = tradeItem?.markupPercent || 0;

    const log_string = `[TRADE - CANCELLED]\n${marketName}\n${value} coins | (${markup}%)`;
    console.log(`%c${DateFormater(new Date())} | ${log_string}`, errorCSSlog);
}

function handleExpired(trade, side, tradeItem) {
    const marketName = tradeItem?.marketName || 'Unknown';
    const value = tradeItem?.value || 0;
    const markup = tradeItem?.markupPercent || 0;

    const log_string = `[TRADE - EXPIRED]\n${marketName}\n${value} coins | (${markup}%)`;
    console.log(`%c${DateFormater(new Date())} | ${log_string}`, errorCSSlog);
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