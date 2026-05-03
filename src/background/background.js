importScripts(
	'../tracking/signer.js',
	'../tracking/queue.js',
	'../tracking/normalizer.js',
	'../tracking/tracker.js'
);

tradeTracker.init();

activeWs = new Set();

const MAX_STEAM_INV_RETRIES = 10;
const STEAM_DNR_RULE_ID = 9999;

async function getSteamSession() {
	const cookies = await chrome.cookies.getAll({ domain: 'steamcommunity.com' });
	const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
	const sessionId = cookies.find(c => c.name === 'sessionid')?.value;
	if (!sessionId) {
		throw new Error('Steam sessionid cookie not found - are you logged into Steam?');
	}
	return { sessionId, cookieString };
}

async function steamCommunityFetch(url, { method = 'POST', body = null, referer = '', cookieString = '' } = {}) {
	await chrome.declarativeNetRequest.updateDynamicRules({
		removeRuleIds: [STEAM_DNR_RULE_ID],
		addRules: [{
			id: STEAM_DNR_RULE_ID,
			priority: 1,
			action: {
				type: 'modifyHeaders',
				requestHeaders: [
					{ header: 'Cookie', operation: 'set', value: cookieString },
					{ header: 'Referer', operation: 'set', value: referer || url }
				]
			},
			condition: {
				urlFilter: url,
				resourceTypes: ['xmlhttprequest']
			}
		}]
	});

	try {
		const res = await fetch(url, {
			method,
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body
		});
		const text = await res.text();
		return { status: res.status, body: text };
	} finally {
		chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: [STEAM_DNR_RULE_ID]
		});
	}
}

function getCsgorollCookies() {
	return new Promise((resolve) => {
		chrome.cookies.getAll({
			domain: "csgoroll.com"
		}, (cookies) => {
			const cookieString = cookies
				.map(cookie => `${cookie.name}=${cookie.value}`)
				.join('; ');
			resolve(cookieString);
		});
	});
}

async function getSessionCookie() {
	const allCookies = await getCsgorollCookies();
	const sessionCookie = allCookies
		.split('; ')
		.find(cookie => cookie.startsWith('session='));

	return sessionCookie || null;
}

async function getSteamAccessTokenViaFetch() {
	const MAX_ATTEMPTS = 5;
	const BACKOFFS_MS = [0, 800, 1600, 3000, 5000];

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		if (BACKOFFS_MS[attempt - 1] > 0) {
			await new Promise(r => setTimeout(r, BACKOFFS_MS[attempt - 1]));
		}

		const url = `https://steamcommunity.com/pointssummary/ajaxgetasyncconfig?_=${Date.now()}-${attempt}`;
		const res = await fetch(url, {
			credentials: 'include',
			cache: 'no-store',
			headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
		});

		if (!res.ok) {
			throw new Error(`Steam ajaxgetasyncconfig failed with status ${res.status}`);
		}

		const json = await res.json();
		if (json.success && json.data?.webapi_token) {
			return json.data.webapi_token;
		}
	}

	return null;
}

async function getSteamAccessTokenViaTab() {
	const TIMEOUT_MS = 20000;

	return new Promise((resolve, reject) => {
		const url = `https://steamcommunity.com/pointssummary/ajaxgetasyncconfig`;
		let settled = false;
		let createdTabId = null;
		let timeoutHandle = null;

		const cleanup = () => {
			chrome.tabs.onUpdated.removeListener(listener);
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
				timeoutHandle = null;
			}
			if (createdTabId != null) {
				try {
					chrome.tabs.remove(createdTabId, () => void chrome.runtime.lastError);
				} catch (_) { /* tab may already be gone */ }
			}
		};

		const finish = (err, token) => {
			if (settled) return;
			settled = true;
			cleanup();
			if (err) reject(err);
			else resolve(token);
		};

		const extractToken = (tabId) => {
			chrome.scripting.executeScript({
				target: { tabId },
				func: () => document.body?.innerText || ''
			}, (results) => {
				if (chrome.runtime.lastError) {
					finish(new Error(chrome.runtime.lastError.message));
					return;
				}
				const text = results?.[0]?.result || '';
				try {
					const json = JSON.parse(text);
					if (json.success && json.data?.webapi_token) {
						finish(null, json.data.webapi_token);
						return;
					}
				} catch (_) { /* fall through */ }
				finish(new Error('Failed to parse Steam webapi_token from tab response'));
			});
		};

		const listener = (updatedTabId, info) => {
			if (updatedTabId !== createdTabId || info.status !== 'complete') return;
			extractToken(updatedTabId);
		};

		chrome.tabs.onUpdated.addListener(listener);

		chrome.tabs.create({ url, active: false }, (tab) => {
			if (chrome.runtime.lastError || !tab || tab.id == null) {
				finish(new Error(chrome.runtime.lastError?.message || 'Failed to create Steam tab'));
				return;
			}
			createdTabId = tab.id;
			timeoutHandle = setTimeout(
				() => finish(new Error('Timed out waiting for Steam tab to load')),
				TIMEOUT_MS
			);
			if (tab.status === 'complete') {
				extractToken(createdTabId);
			}
		});
	});
}

async function getSteamAccessToken() {
	try {
		const token = await getSteamAccessTokenViaFetch();
		if (token) return token;
		console.log('[STEAM_TOKEN]: fetch method returned no token, falling back to tab method...');
	} catch (e) {
		console.log(`[STEAM_TOKEN]: fetch method failed (${e.message}), falling back to tab method...`);
	}

	return await getSteamAccessTokenViaTab();
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.type === 'getSessionCookie') {
		getSessionCookie().then(session => {
			sendResponse({ session });
		}).catch(err => {
			console.error(err);
			sendResponse({ session: null });
		});

		return true;
	}
});

chrome.runtime.onInstalled.addListener(() => {
	chrome.alarms.create('refresh_cspricebase', {
		periodInMinutes: 45
	});
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name === 'refresh_cspricebase') {
		await refreshCsPriceBase();
	}
});

async function refreshCsPriceBase() {
	const API_URL = `https://cspricebase.com/api/get-rollhelper-prices`;
	const EXTENSION_CACHE_DURATION = 20 * 60 * 1000;

	const { pricing_timestamp, pricing_etag, pricing_data } =
		await chrome.storage.local.get([
			'pricing_timestamp',
			'pricing_etag',
			'pricing_data',
		]);

	const { cspApi } = await chrome.storage.sync.get("cspApi")

	if (!cspApi) return;

	const headers = {
		Authorization: `Bearer ${cspApi}`
	};

	if (pricing_etag) {
		headers['If-None-Match'] = pricing_etag;
	}

	const response = await fetch(API_URL, { headers, cache: 'no-store' });

	const now = Date.now();

	if (response.status === 304) {
		await chrome.storage.local.set({ pricing_timestamp: now });
		return;
	}

	if (!response.ok) return;

	const data = await response.json();
	const etag = response.headers.get('etag');

	await chrome.storage.local.set({
		pricing_data: data,
		pricing_timestamp: now,
		pricing_etag: etag
	});

	chrome.tabs.query({}, tabs => {
		for (const tab of tabs) {
			chrome.tabs.sendMessage(tab.id, {
				type: 'PRICES_UPDATED',
				data
			});
		}
	});
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "applyPromoApi") {
		getCsgorollCookies().then(cookieString => {
			const payload = {
				operationName: "applyPromoCodeTimer",
				query: `
			  mutation applyPromoCodeTimer($input: ApplyPromoCodeInput!) {
					applyPromoCodeTimer(input: $input) {
					  promoCode
					  secondsLeft
					  status
					  __typename
				}
			  }
			`,
				variables: {
					input: {
						code: "RLHLPR",
					},
				},
			};

			fetch(request.domain, {
				method: "POST",
				headers: {
					"Accept": "application/json, text/plain, */*",
					"Content-Type": "application/json",
					"Cookie": cookieString,
					"Origin": "https://www.csgoroll.com",
					"Referer": "https://www.csgoroll.com/"
				},
				credentials: "include",
				body: JSON.stringify(payload),
			})
				.then(res => res.json())
				.then(data => sendResponse(data))
				.catch(error => sendResponse({ error: error.message }));
		});
		return true;
	}

	if (request.action === "getUserID") {
		getCsgorollCookies().then(cookieString => {
			fetch(request.domain, {
				method: 'POST',
				headers: {
					Accept: 'application/json, text/plain, */*',
					'Content-Type': 'application/json',
					'Cookie': cookieString,
					'Origin': 'https://www.csgoroll.com',
					'Referer': 'https://www.csgoroll.com/'
				},
				credentials: 'include',
				body: JSON.stringify({
					operationName: 'CurrentUser',
					variables: {},
					query: `query CurrentUser {
				  currentUser {
					id
					steamId
					steamAccessToken
					steamAccessTokenExpiresAt
					__typename
				  }
				}`
				})
			})
				.then(res => res.json())
				.then(data => sendResponse(data))
				.catch(error => sendResponse({ error: error.message }));
		});
		return true;
	}

	if (request.action === "getCurrentSteamInvData") {
		getCsgorollCookies().then(cookieString => {
			const userID = request.userID;
			let afterID = '';
			let itemsList = [];
			let invFailFetchCount = 0;

			const fetchInv = () => {
				fetch(request.domain, {
					method: 'POST',
					headers: {
						Accept: 'application/json, text/plain, */*',
						'Content-Type': 'application/json',
						'Cookie': cookieString,
						'Origin': 'https://www.csgoroll.com',
						'Referer': 'https://www.csgoroll.com/',
					},
					credentials: 'include',
					body: JSON.stringify({
						operationName: 'steamInventoryItems',
						variables: {
							steamAppName: 'CSGO',
							first: 250,
							userId: userID,
							after: `${afterID}`,
						},
						query: `
								query steamInventoryItems(
									$after: String,
									$first: PaginationAmount,
									$steamAppName: SteamAppName = CSGO,
									$userId: ID
								) {
									steamInventoryItems(
										after: $after
										first: $first
										steamAppName: $steamAppName
										userId: $userId
									) {
										pageInfo {
											hasNextPage
											endCursor
										}
										edges {
											node {
												tradable
												steamExternalAssetId
												steamItemIdentifiers {
													assetId
												}
												steamInspectItem {
													paintWear
												}
												steamStickersDescriptions {
													name
												}
												itemVariant {
													value
													externalId
													itemId
												}
											}
										}
									}
								}
							`,
					}),
				})
					.then(res => res.json())
					.then(res => {
						let tradeListData = res.data.steamInventoryItems.edges;
						let hasNextPage = res.data.steamInventoryItems.pageInfo.hasNextPage;
						for (const itemData of tradeListData) {
							let itemValue = itemData.node.itemVariant.value;


							if (itemData.node.tradable === true) {
								let item = {};
								let stickers = itemData.node.steamStickersDescriptions.map(s => s.name);
								item.steamExternalId = itemData.node.steamExternalAssetId;
								item.marketName = itemData.node.itemVariant.externalId;
								item.assetID = itemData.node.steamItemIdentifiers.assetId;
								item.itemID = itemData.node.itemVariant.itemId;
								item.stickers = stickers;
								if (itemData.node.steamInspectItem?.paintWear) {
									item.float = Math.floor(itemData.node.steamInspectItem.paintWear * 1000) / 1000;
								}
								itemsList.push(item);
							}
						}
						if (hasNextPage) {
							afterID = res.data.steamInventoryItems.pageInfo.endCursor;
							fetchInv();
						} else {
							sendResponse(itemsList)
							console.log(
								`[ROLLHELPER] -> Successfully loaded tradable items from steam: (${itemsList.length})`);

						}
					})
					.catch(error => {
						console.log(
							`[ROLLHELPER - ERROR] -> Failed to load the steam inventory data - trying again in 5 seconds`);
						console.log(error);
						invFailFetchCount += 1;
						setTimeout(() => {
							if (invFailFetchCount <= MAX_STEAM_INV_RETRIES) {
								fetchInv();
							} else {
								console.log(`[ROLLHELPER - ERROR] -> Max amount of tries reached - refresh the page to load inventory`);
								sendResponse({ error: error.message })
							}
						}, 5000);
					});
			};
			fetchInv();
		});
		return true;
	}

	if (request.action === "fetchUserListedTrades") {
		getCsgorollCookies().then(cookieString => {
			let allTrades = [];
			let afterCursor = '';

			const fetchPage = () => {
				const variables = {
					first: 250,
					orderBy: ['ID_DESC'],
					statuses: 'LISTED',
					userId: request.userId,
				};
				if (afterCursor) variables.after = afterCursor;

				fetch(request.domain, {
					method: 'POST',
					headers: {
						Accept: 'application/json, text/plain, */*',
						'Content-Type': 'application/json',
						'Cookie': cookieString,
						'Origin': 'https://www.csgoroll.com',
						'Referer': 'https://www.csgoroll.com/'
					},
					credentials: 'include',
					body: JSON.stringify({
						operationName: 'UserTradeList',
						variables,
						query: `query UserTradeList($first: PaginationAmount, $after: String, $orderBy: [TradeOrderBy], $statuses: TradeStatus, $userId: ID) { trades(first: $first, after: $after, orderBy: $orderBy, status: $statuses, userId: $userId) { edges { node { ...SimpleTrade __typename } __typename } pageInfo { hasNextPage endCursor __typename } __typename } } fragment SimpleTrade on Trade { id depositorLastActiveAt markupPercent totalValue avgPaintWear hasStickers tradeItems { ...SimpleTradeItem __typename } trackingType avgPaintWearRange { min max __typename } canJoinAfter depositor { id steamDisplayName steamId __typename } suspectedTraderCanJoinAfter status steamAppName customValue createdAt updatedAt canJoin expiresAt withdrawer { id steamId steamDisplayName steamLevel avatar steamRegistrationDate name __typename } joinedAt cancelReason withdrawerSteamTradeUrl __typename } fragment SimpleTradeItem on TradeItem { id marketName markupPercent customValue steamExternalAssetId itemVariant { ...SimpleTradeItemVariant __typename } stickers { ...SimpleTradeItemSticker __typename } value patternPercentage __typename } fragment SimpleTradeItemVariant on ItemVariant { brand color name iconUrl rarity depositable itemId id value currency externalId __typename } fragment SimpleTradeItemSticker on TradeItemSticker { imageUrl id name color wear brand __typename }`,
					}),
				})
					.then(res => res.json())
					.then(data => {
						const trades = data?.data?.trades;
						if (trades?.edges) {
							allTrades.push(...trades.edges.map(e => e.node));
						}
						if (trades?.pageInfo?.hasNextPage && trades?.pageInfo?.endCursor) {
							afterCursor = trades.pageInfo.endCursor;
							fetchPage();
						} else {
							sendResponse(allTrades);
						}
					})
					.catch(error => sendResponse({ error: error.message }));
			};
			fetchPage();
		});
		return true;
	}

	if (request.action === "cancelCsgorollTrade") {
		getCsgorollCookies().then(cookieString => {
			fetch(request.domain, {
				method: 'POST',
				headers: {
					Accept: 'application/json, text/plain, */*',
					'Content-Type': 'application/json',
					'Cookie': cookieString,
					'Origin': 'https://www.csgoroll.com',
					'Referer': 'https://www.csgoroll.com/'
				},
				credentials: 'include',
				body: JSON.stringify({
					operationName: 'CancelTrade',
					variables: {
						input: { tradeId: request.tradeId }
					},
					query: `mutation CancelTrade($input: CancelTradeInput!) { cancelTrade(input: $input) { trade { id cancelReason expiresAt status totalValue __typename } __typename } }`,
				}),
			})
				.then(res => res.json())
				.then(data => sendResponse(data))
				.catch(error => sendResponse({ error: error.message }));
		});
		return true;
	}

	if (request.action === "relistDeposit") {
		getCsgorollCookies().then(cookieString => {
			fetch(request.domain, {
				method: 'POST',
				headers: {
					Accept: 'application/json, text/plain, */*',
					'Content-Type': 'application/json',
					'Cookie': cookieString,
					'Origin': 'https://www.csgoroll.com',
					'Referer': 'https://www.csgoroll.com/'
				},
				credentials: 'include',
				body: JSON.stringify({
					operationName: 'createTrades',
					variables: {
						input: {
							tradeItemsList: [
								[
									{
										assetId: request.assetId,
										itemVariantId: request.itemVariantId,
										value: request.value,
									}
								]
							],
							trackByUniqueId: true,
							visualRecaptcha: null,
						}
					},
					query: `mutation createTrades($input: CreateTradesInput!) { createTrades(input: $input) { trades { ...SimpleTrade __typename } __typename } } fragment SimpleTrade on Trade { id depositorLastActiveAt markupPercent totalValue avgPaintWear hasStickers tradeItems { ...SimpleTradeItem __typename } trackingType avgPaintWearRange { min max __typename } canJoinAfter depositor { id steamDisplayName steamId __typename } suspectedTraderCanJoinAfter status steamAppName customValue createdAt updatedAt canJoin expiresAt withdrawer { id steamId steamDisplayName steamLevel avatar steamRegistrationDate name __typename } joinedAt cancelReason withdrawerSteamTradeUrl __typename } fragment SimpleTradeItem on TradeItem { id marketName markupPercent customValue steamExternalAssetId itemVariant { ...SimpleTradeItemVariant __typename } stickers { ...SimpleTradeItemSticker __typename } value patternPercentage __typename } fragment SimpleTradeItemVariant on ItemVariant { brand color name iconUrl rarity depositable itemId id value currency externalId __typename } fragment SimpleTradeItemSticker on TradeItemSticker { imageUrl id name color wear brand __typename }`,
				}),
			})
				.then(res => res.json())
				.then(data => sendResponse(data))
				.catch(error => sendResponse({ error: error.message }));
		});
		return true;
	}

	if (request.action === "fetchAcceptTrade") {
		getCsgorollCookies().then(cookieString => {
			fetch(request.domain, {
				method: 'POST',
				headers: {
					Accept: 'application/json, text/plain, */*',
					'Content-Type': 'application/json',
					'Cookie': cookieString,
					'Origin': 'https://www.csgoroll.com',
					'Referer': 'https://www.csgoroll.com/'
				},
				credentials: 'include',
				body: JSON.stringify({
					operationName: 'ProcessTrade',
					variables: {
						input: {
							tradeId: request.tradeid,
						},
					},
					query: `
					mutation ProcessTrade($input: ProcessTradeInput!) {
						processTrade(input: $input) {
							trade {
								id
								status
								totalValue
								updatedAt
								expiresAt
								withdrawerSteamTradeUrl
								__typename
							}
							__typename
						}
					}
				`,
				}),
			})
				.then(res => res.json())
				.then(data => {
					sendResponse(data);
				})
				.catch(error => {
					sendResponse({ error: error.message });
				});
		});

		return true;
	}
});


chrome.runtime.onInstalled.addListener(details => {
	if (details.reason === 'install') {
		chrome.storage.sync.set(
			{
				steamOfferMessage: null,
				wantSendOffers: false,
				wantCompletedAlert: false,
				wantCooldownAlert: false,
				dcNotifyState: false,
				wantWithdrawalAlert: false,
				wantDepoAlert: false,
				peApi: null,
				switchDepoState: false,
				wantAutoRelist: false,
				wantAutoTokenUpdate: true,
				wantAutoTokenUpdateState: true,
				switchNotifyState: false,
				token: null,
				userkey: null,
				webhook: null,
			},
			() => {
				console.log(
					'Rollhelper_service_worker: Initial values set for the first time install.',
				);
			},
		);
	}
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	switch (msg.type) {
		case "updateAccessToken":
			(async () => {
				try {
					if (!msg.steamId) {
						sendResponse({ error: "steamId is required for updateAccessToken" });
						return;
					}

					const token = await getSteamAccessToken();
					const cookieString = await getCsgorollCookies();

					const res = await fetch(msg.domain, {
						method: 'POST',
						headers: {
							Accept: 'application/json, text/plain, */*',
							'Content-Type': 'application/json',
							'Cookie': cookieString,
							'Origin': 'https://www.csgoroll.com',
							'Referer': 'https://www.csgoroll.com/'
						},
						credentials: 'include',
						body: JSON.stringify({
							query: `
							  mutation changeSteamAccessToken($input: UpdateSteamAccessTokenInput!) {
								updateSteamAccessToken(input: $input) {
								  success
								  __typename
								}
							  }`,
							variables: {
								input: {
									steamId: msg.steamId,
									accessToken: token
								}
							},
							operationName: "changeSteamAccessToken"
						})
					});

					const data = await res.json();
					sendResponse(data);
				} catch (error) {
					console.log(error);
					sendResponse({ error: error.message });
				}
			})()
			return true;

		case 'getActiveRollUrls':
			chrome.tabs.query({}, function (tabs) {
				csgorollActiveUrls = 0;
				let res = [];
				for (const tab of tabs) {
					if (tab.url.includes('www.csgoroll')) {
						currentDomain = tab.url;
						csgorollActiveUrls += 1;
						res = [currentDomain, csgorollActiveUrls];
					}
				}
				sendResponse(res);
			});
			return true;

		case 'sendSteamOffer':
			(async () => {
				try {
					const tradeUrl = new URL(msg.tradeLink);
					const partnerId = tradeUrl.searchParams.get('partner');
					const tradeToken = tradeUrl.searchParams.get('token');

					if (!partnerId || !tradeToken) {
						sendResponse({ error: 'Invalid trade link - missing partner or token' });
						return;
					}

					const { sessionId, cookieString } = await getSteamSession();
					const partnerSteamId64 = (BigInt('76561197960265728') + BigInt(partnerId)).toString();

					const tradeOfferParams = {
						newversion: true,
						version: 4,
						me: {
							assets: [{ appid: 730, contextid: "2", amount: 1, assetid: msg.assetID }],
							currency: [],
							ready: false
						},
						them: {
							assets: [],
							currency: [],
							ready: false
						}
					};

					const body = new URLSearchParams({
						sessionid: sessionId,
						serverid: '1',
						partner: partnerSteamId64,
						tradeoffermessage: msg.offerMsg || '',
						json_tradeoffer: JSON.stringify(tradeOfferParams),
						captcha: '',
						trade_offer_create_params: JSON.stringify({ trade_offer_access_token: tradeToken })
					});

					const res = await steamCommunityFetch('https://steamcommunity.com/tradeoffer/new/send', {
						referer: `https://steamcommunity.com/tradeoffer/new/?partner=${partnerId}&token=${tradeToken}`,
						cookieString,
						body
					});

					let data;
					try {
						data = JSON.parse(res.body);
					} catch {
						sendResponse({ error: `Steam returned non-JSON (status ${res.status}): ${res.body?.substring(0, 200)}` });
						return;
					}

					if (data && data.tradeofferid) {
						sendResponse({ success: true, tradeofferid: data.tradeofferid });
					} else {
						sendResponse({ error: data?.strError || `Failed to send trade offer (status ${res.status}): ${res.body?.substring(0, 300)}` });
					}
				} catch (error) {
					sendResponse({ error: error.message });
				}
			})();
			return true;

		case 'cancelSteamOffer':
			(async () => {
				try {
					const { sessionId, cookieString } = await getSteamSession();

					const res = await steamCommunityFetch(`https://steamcommunity.com/tradeoffer/${msg.tradeofferid}/cancel`, {
						referer: `https://steamcommunity.com/tradeoffer/${msg.tradeofferid}/`,
						cookieString,
						body: new URLSearchParams({ sessionid: sessionId })
					});

					if (res.status === 200) {
						sendResponse({ success: true });
					} else {
						sendResponse({ error: `Failed to cancel trade offer (status ${res.status}): ${res.body?.substring(0, 200)}` });
					}
				} catch (error) {
					sendResponse({ error: error.message });
				}
			})();
			return true;

		case 'cspricebase':
			(async () => {
				try {
					const API_URL = `https://cspricebase.com/api/get-rollhelper-prices`;

					const EXTENSION_CACHE_DURATION =  20 * 60 * 1000; // 15 mins
					const apiKey = msg.key;

					if (!apiKey) {
						sendResponse({ error: 'APIKEY for cspricebase was not found.' });
						return;
					}

					const storage = await chrome.storage.local.get([
						'pricing_data',
						'pricing_timestamp',
						'pricing_etag'
					]);

					const now = Date.now();
					const cacheAge = now - (storage.pricing_timestamp || 0);

					// Return cached data if still valid
					if (storage.pricing_data && cacheAge < EXTENSION_CACHE_DURATION) {
						console.log('Using cached pricing data');
						sendResponse({ data: storage.pricing_data });
						return;
					}

					const headers = {
						'Authorization': `Bearer ${apiKey}`
					};

					if (storage.pricing_etag) {
						headers['If-None-Match'] = storage.pricing_etag;
					}

					const response = await fetch(API_URL, { headers, cache: 'no-store',  });

					if (response.status === 304) {
						console.log('Data unchanged (304), updating timestamp');
						await chrome.storage.local.set({
							'pricing_timestamp': now
						});
						sendResponse({ data: storage.pricing_data });
						return;
					}

					if (!response.ok) {
						sendResponse({ error: `Failed to load cspricebase prices: ${response.status}` });
						return;
					}

					const data = await response.json();
					const etag = response.headers.get('etag');

					// Cache the new data
					await chrome.storage.local.set({
						'pricing_data': data,
						'pricing_timestamp': now,
						'pricing_etag': etag
					});

					console.log('Fetched and cached new pricing data');
					sendResponse({ data: data });

				} catch (e) {
					console.error('Unexpected error:', e);
					sendResponse({ error: 'Unexpected error: ' + e.message });
				}
			})();
			return true;
			break;

		case 'open_ws':
			let id = msg.userid;

			if (activeWs.has(id)) sendResponse(false);

			activeWs.add(id);
			sendResponse(true);
			break;

		case 'track_trade':
			(async () => {
				try {
					const storage = await chrome.storage.local.get('pricing_data');
					await tradeTracker.trackEvent(msg.payload, storage.pricing_data || null);
					sendResponse({ ok: true });
				} catch (err) {
					console.error('[TradeTracker] Error handling track_trade:', err);
					sendResponse({ ok: false, error: err.message });
				}
			})();
			return true;

		case 'get_tracker_status':
			(async () => {
				const status = await tradeTracker.getStatus();
				sendResponse(status);
			})();
			return true;
	}
});

const pingActiveWsSessions = id => {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({}, tabs => {
			let responseReceived = false;

			const responses = tabs.map(tab => {
				return new Promise(res => {
					chrome.tabs.sendMessage(
						tab.id,
						{ type: 'ping_ws', userid: id },
						response => {
							if (chrome.runtime.lastError) {
								res(false);
							} else {
								res(response);
							}
						},
					);
				});
			});

			Promise.all(responses)
				.then(results => {
					if (results.includes(true)) {
						responseReceived = true;
						resolve(true);
					} else {
						resolve(false);
					}
				})
				.catch(err => reject(err));
		});
	});
};

// periodical ping to active ws-sessions
setInterval(async () => {
	if (activeWs.size > 0) {
		for (const id of activeWs) {
			try {
				let response = await pingActiveWsSessions(id);
				if (!response) {
					activeWs.delete(id);
				}
			} catch (error) {
				activeWs.delete(id);
			}
		}
	}
}, 10_000);