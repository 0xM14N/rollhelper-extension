console.log(
    `%c[ROLLHELPER] [v1.1.9]`,
    'color:#eb0909;font-weight: bold; font-size:23px',
);

console.log(
    `%cInterested in custom features / upgrades (token updater, always-on store, etc) Contact me at discord: maintrades`,
    'color:#7CFC00FF;background:black;font-weight:bold;font-size:10px',
);

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
const MAX_RECONNECT_ATTEMPTS = 9;
const RECONNECT_BASE_DELAY = 62_000; // 62s
const RECONNECT_MAX_DELAY = 82_000;// 82s


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'ping_ws' && msg.userid === userID && connected) {
        sendResponse(true);
    } else {
        sendResponse(false);
    }
    return true;
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
        rates = await fetchRates();
        await getCurrentSteamInvData(userID);
        await updateSettings();
        await initConnection();
    } catch (error) {
        console.error('Error in initRollhelper:', error);
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
        enqueueMessage(JSON.stringify({ type: "ping" }));
    } catch (e) {
        console.log(e);
    }
}

function connectWSS() {

    if (socket != null) {
        try {
            socket.close();
        } catch (e) {
            console.log(e);
        }
    }

    socket = new WebSocket(
        'wss://api-trader.csgoroll.com/graphql',
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

        pI = setInterval(sp, 50000);
    };

    socket.onmessage = async (event) => {
        let data = JSON.parse(event.data);
        if (data?.type === 'connection_ack') {
            console.log(
                `%c${DateFormater(new Date())} | [ROLLHELPER - CONNECTED]`,
                noticeCSSlog,
            );
        }

        if (data?.payload?.data?.updateTrade) {
            let trade = data.payload.data.updateTrade.trade;
            if (trade.withdrawer != null && trade.status === 'JOINED') {
                // DEPOSIT EVENT
                if (trade.depositor.id === userID && depoAutoAccept) {
                    let marketName = trade.tradeItems[0].marketName;
                    let markup = trade.tradeItems[0].markupPercent;
                    let value = trade.tradeItems[0].value;
                    let withdrawerName = trade.withdrawer.displayName;
                    let withdrawerID = trade.withdrawer.id;
                    let float = trade.avgPaintWear;
                    let ID = trade.tradeItems[0].itemVariant.id;
                    let itemID = trade.tradeItems[0].itemVariant.itemId;
                    let stickersArr = trade.tradeItems[0].stickers;
                    let basePrice = trade.tradeItems[0].itemVariant.value;
                    let icon_url = trade.tradeItems[0].itemVariant.iconUrl;

                    let addedStickersValue = 0;
                    let maxMarkup = 12;
                    let coinsToUsd;
                    //acceptTrade(trade.id); ~ wss accept not working, using requests instead
                    let data = await fetchAcceptTrade(trade.id);

                    if (stickersArr.length > 0) {
                        for (const sticker of stickersArr) {
                            if (sticker.wear == 0) {
                                addedStickersValue += sticker.value / 5;
                            } else {
                                addedStickersValue += sticker.value / 20;
                            }
                        }
                        maxMarkup = evalMaxMarkup(basePrice, addedStickersValue);
                    }

                    let usd;
                    let profit;
                    let rate;
                    let eval_res = buffProfitEval(marketName, value, 'deposit');

                    usd = eval_res ? eval_res[0] : '-';
                    profit = eval_res ? eval_res[1] : '-';
                    rate = eval_res ? eval_res[2] : '-';
                    coinsToUsd = eval_res ? (value * rate).toFixed(2) : '-';
                    liquidity = eval_res ? eval_res[3] : '-';

                    let trade_info = {
                        marketname: marketName,
                        float: float,
                        value: value,
                        markup: markup,
                        maxMarkup: maxMarkup,
                        coins_usd: coinsToUsd,
                        buff163: usd,
                        buff_percent: profit,
                        withdrawer_name: withdrawerName,
                        withdrawer_id: withdrawerID,
                        iconUrl: icon_url,
                    };

                    const encodedItemName = encodeURIComponent(marketName)
                        .replace(/\(/g, '%28')
                        .replace(/\)/g, '%29');
                    const buffUrl =
                        'https://api.pricempire.com/v1/redirectBuff/' + encodedItemName;
                    console.log(
                        `%c${DateFormater(new Date())} | [DEPOSIT]\n\t${marketName}\n\t${value} coins | (${markup}%) | ${coinsToUsd}$\n\t[LIQ]: ${liquidity}% | [MAX MARKUP]: ${maxMarkup}%\n\t[BUFF163]: ${usd}$ (RATE: ${rate})\n\t[Price-Of-BUFF]: ${profit}%`,
                        depositCSSlog,
                    );
                    console.log(buffUrl);
                    itemInfo.tradeInfo = `[DEPOSIT]\n${marketName}\n${value} coins | +${markup}%\n[FV: ${float}]`;
                    if (depoAlert) {
                        if (Pushover) {
                            sendPushoverNotification(itemInfo);
                        }
                        if (discord) {
                            sendWebHookDiscord(
                                Webhook,
                                (webhookType = 'areYouReady'),
                                trade_info,
                            );
                        }
                    }
                }

                if (trade.depositor.id != userID) {
                    let marketName = trade.tradeItems[0].marketName;
                    let markup = trade.tradeItems[0].markupPercent;
                    let value = trade.tradeItems[0].value;
                    let rollName = trade.depositor.displayName;
                    let steamName = trade.depositor.steamDisplayName;
                    let rollID = trade.depositor.id;
                    let float = trade.avgPaintWear;
                    let usd;
                    let profit;
                    let rate;
                    let coinsToUsd;
                    let stickersArr = trade.tradeItems[0].stickers;
                    let basePrice = trade.tradeItems[0].itemVariant.value;
                    let addedStickersValue = 0;
                    let maxMarkup = 12;
                    if (stickersArr.length > 0) {
                        for (const sticker of stickersArr) {
                            if (sticker.wear == 0) {
                                addedStickersValue += sticker.value / 5;
                            } else {
                                addedStickersValue += sticker.value / 20;
                            }
                        }
                        maxMarkup = evalMaxMarkup(basePrice, addedStickersValue);
                    }

                    let eval_res = buffProfitEval(marketName, value);
                    usd = eval_res ? eval_res[0] : '-';
                    profit = eval_res ? eval_res[1] : '-';
                    rate = eval_res ? eval_res[2] : '-';
                    coinsToUsd = eval_res ? (value * rate).toFixed(2) : '-';
                    liquidity = eval_res ? eval_res[3] : '-';

                    console.log(
                        `%c${DateFormater(new Date())} | [WITHDRAW - WAITING]\n\t${marketName}\n\t${value} coins | (${markup}%) | ${coinsToUsd}$\n\t[LIQ]: ${liquidity}% | [MAX MARKUP]: ${maxMarkup}%\n\tROLLNAME: ${rollName}\n\tRollID: ${rollID}\n\t[BUFF163]: ${usd}$ (RATE: ${rate})\n\t[Price-Of-BUFF]: ${profit}%`,
                        noticeCSSlog,
                    );
                }
            }

            // COMPLETED EVENT
            if (trade.withdrawer != null && trade.status === 'COMPLETED') {
                let marketName = trade.tradeItems[0].marketName;
                let markup = trade.tradeItems[0].markupPercent;
                let value = trade.tradeItems[0].value;
                let float = trade.avgPaintWear;
                let icon_url = trade.tradeItems[0].itemVariant.iconUrl;

                let usd;
                let profit;
                let rate;
                let coinsToUsd;

                let stickersArr = trade.tradeItems[0].stickers;
                let basePrice = trade.tradeItems[0].itemVariant.value;
                let addedStickersValue = 0;
                let maxMarkup = 12;
                if (stickersArr.length > 0) {
                    for (const sticker of stickersArr) {
                        if (sticker.wear == 0) {
                            addedStickersValue += sticker.value / 5;
                        } else {
                            addedStickersValue += sticker.value / 20;
                        }
                    }
                    maxMarkup = evalMaxMarkup(basePrice, addedStickersValue);
                }

                let eval_res = buffProfitEval(marketName, value);
                usd = eval_res ? eval_res[0] : '-';
                profit = eval_res ? eval_res[1] : '-';
                rate = eval_res ? eval_res[2] : '-';
                coinsToUsd = eval_res ? (value * rate).toFixed(2) : '-';
                liquidity = eval_res ? eval_res[3] : '-';

                let trade_info = {
                    marketname: marketName,
                    float: float,
                    value: value,
                    markup: markup,
                    maxMarkup: maxMarkup,
                    coins_usd: coinsToUsd,
                    buff163: usd,
                    buff_percent: profit,
                    iconUrl: icon_url,
                };

                console.log(
                    `%c${DateFormater(new Date())} | [TRADE - COMPLETED]\n\t${marketName}\n\t${value} coins | (${markup}%) | ${coinsToUsd}$\n\t[LIQ]: ${liquidity}% | [MAX MARKUP]: ${maxMarkup}%\n\t[BUFF163]: ${usd}$ (RATE: ${rate})\n\t[Price-Of-BUFF]: ${profit}%`,
                    tradeCompletedCSSlog,
                );
                itemInfo.tradeInfo = `[TRADE - COMPLETED]\n${marketName}\n${value} coins | +${markup}%\n[FV: ${float}]`;

                if (depoAlert && completedAlert) {
                    if (Pushover) sendPushoverNotification(itemInfo);
                    if (discord)
                        sendWebHookDiscord(
                            Webhook,
                            (webhookType = 'TradeCompleted'),
                            trade_info,
                        );
                }
            }
            // COOLDOWN EVENT
            if (trade.withdrawer != null && trade.status === 'COOLDOWN') {
                let marketName = trade.tradeItems[0].marketName;
                let markup = trade.tradeItems[0].markupPercent;
                let value = trade.tradeItems[0].value;
                let float = trade.avgPaintWear;
                let icon_url = trade.tradeItems[0].itemVariant.iconUrl;

                let trade_info = {
                    marketname: marketName,
                    float: float,
                    value: value,
                    markup: markup,
                    iconUrl: icon_url,
                };

                console.log(
                    `%c${DateFormater(new Date())} | [TRADE - COOLDOWN]\n\t${marketName}\n\t${value} coins | (${markup}%)\n\t[FV]: ${float}`,
                    errorCSSlog,
                );
                itemInfo.tradeInfo = `[TRADE - COOLDOWN]\n${marketName}\n${value} coins | +${markup}%\n[FV: ${float}]`;

                if (depoAlert && cooldownAlert) {
                    if (Pushover) sendPushoverNotification(itemInfo);
                    if (discord)
                        sendWebHookDiscord(
                            Webhook,
                            (webhookType = 'TradeCooldown'),
                            trade_info,
                        );
                }
            }

            // STEAM OFFER SENDING EVENT
            if (trade.withdrawer != null && trade.status === 'PROCESSING') {
                if (trade.depositor.id == userID && sendSteamOffers) {
                    //send the steam offer here
                    let markup = trade.tradeItems[0].markupPercent;
                    let value = trade.tradeItems[0].value;
                    let marketName = trade.tradeItems[0].marketName;
                    let float = trade.avgPaintWear;
                    let ID = trade.tradeItems[0].itemVariant.id;
                    let itemID = trade.tradeItems[0].itemVariant.itemId;
                    let tradeLink =
                        data.payload.data.updateTrade.trade.withdrawerSteamTradeUrl;
                    let asset;
                    let found = false;
                    let externalSteamId =
                        data.payload.data.updateTrade.trade.tradeItems[0]
                            .steamExternalAssetId;

                    let stickers = trade.tradeItems[0].stickers;
                    let formattedStickersText = '';
                    for (const sticker of stickers) {
                        if (sticker.color != null) {
                            formattedStickersText += `${sticker.name} (${sticker.color})\n`;
                        } else {
                            formattedStickersText += `${sticker.name}\n`;
                        }
                    }
                    for (const item of itemsList) {
                        if (
                            item.itemID === itemID &&
                            item.steamExternalId === externalSteamId
                        ) {
                            asset = item.assetID;
                            found = true;
                            sendSteamTradeOffer(asset, tradeLink, offerMessage);
                            console.log(
                                `%c${DateFormater(new Date())} | [ROLLHELPER - Steam offer sent]`,
                                steamOfferCSSlog,
                            );
                            break;
                        }
                    }

                    if (!found) {
                        console.log(
                            `%c${DateFormater(new Date())} | [ROLLHELPER - Steam offer error (item not found)]`,
                            errorCSSlog,
                        );
                    }
                }

                // WITHDRAW-ACCEPTED EVENT
                if (trade.depositor.id != userID) {
                    let marketName = trade.tradeItems[0].marketName;
                    let markup =
                        trade.tradeItems[0].markupPercent;
                    let value = trade.tradeItems[0].value;
                    let float = trade.avgPaintWear;
                    let icon_url = trade.tradeItems[0].itemVariant.iconUrl;
                    let usd;
                    let profit;
                    let rate;
                    let coinsToUsd;
                    let stickersArr = trade.tradeItems[0].stickers;
                    let basePrice = trade.tradeItems[0].itemVariant.value;
                    let addedStickersValue = 0;
                    let maxMarkup = 12;
                    let formattedStickersText = '';

                    if (stickersArr.length > 0) {
                        for (const sticker of stickersArr) {
                            if (sticker.wear == 0) {
                                addedStickersValue += sticker.value / 5;
                            } else {
                                addedStickersValue += sticker.value / 20;
                            }
                            if (sticker.color != null) {
                                formattedStickersText += `\t${sticker.name} (${sticker.color})\n`;
                            } else {
                                formattedStickersText += `\t${sticker.name}\n`;
                            }
                        }
                        maxMarkup = evalMaxMarkup(basePrice, addedStickersValue);
                    }

                    let eval_res = buffProfitEval(marketName, value);
                    usd = eval_res ? eval_res[0] : '-';
                    profit = eval_res ? eval_res[1] : '-';
                    rate = eval_res ? eval_res[2] : '-';
                    coinsToUsd = eval_res ? (value * rate).toFixed(2) : '-';
                    liquidity = eval_res ? eval_res[3] : '-';

                    let trade_info = {
                        marketname: marketName,
                        float: float,
                        value: value,
                        markup: markup,
                        maxMarkup: maxMarkup,
                        coins_usd: coinsToUsd,
                        buff163: usd,
                        buff_percent: profit,
                        iconUrl: icon_url,
                    };

                    const encodedItemName = encodeURIComponent(marketName)
                        .replace(/\(/g, '%28')
                        .replace(/\)/g, '%29');
                    const buffUrl =
                        'https://api.pricempire.com/v1/redirectBuff/' + encodedItemName;
                    const cspUrl = "https://cspricebase.com/database?marketName=" + encodedItemName;

                    console.log(
                        `%c${DateFormater(new Date())} | [WITHDRAW - ACCEPTED]\n\t${marketName}\n\t${value} coins | (${markup}%) | ${coinsToUsd}$\n\t[LIQ]: ${liquidity}% | [MAX MARKUP]: ${maxMarkup}%\n\t[BUFF163]: ${usd}$ (RATE: ${rate})\n\t[Price-Of-BUFF]: ${profit}%`,
                        withdrawAcceptedCSSlog,
                    );

                    console.log("%cCS:PRICEBASE - COMPARATOR ➡ (LIVE PRICES)", cspCSSlog, cspUrl);


                    itemInfo.tradeInfo = `[WITHDRAW]\n${marketName}\n${value} coins | +${markup}% (MAX: ${maxMarkup}%)\n[FV: ${float}]\n [STICKERS]:\n${formattedStickersText}`;

                    if (withdrawAlert == true) {
                        if (Pushover) sendPushoverNotification(itemInfo);
                        if (discord)
                            sendWebHookDiscord(
                                Webhook,
                                (webhookType = 'IncommingTrade'),
                                trade_info,
                            );
                    }
                }
            }
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
        if (pi)  clearInterval(pI);

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