importScripts(
	'../tracking/signer.js',
	'../tracking/queue.js',
	'../tracking/normalizer.js',
	'../tracking/tracker.js'
);

tradeTracker.init();

activeWs = new Set();

const MAX_STEAM_INV_RETRIES = 10;

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

//todo: rework - more lightweight endpoint to grab the data (dont open tab? fetch?)
async function getSteamData() {
	return new Promise((resolve, reject) => {
		chrome.tabs.create({ url: 'https://steamcommunity.com/', active: false }, function (tab) {
			if (!tab || !tab.id) {
				reject('Failed to create Steam tab');
				return;
			}

			chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
				if (tabId === tab.id && info.status === 'complete') {
					chrome.tabs.onUpdated.removeListener(listener);

					chrome.scripting.executeScript({
						target: { tabId: tab.id },
						func: () => {
							const body = document.documentElement.innerHTML;

							const steamIdMatch = /g_steamID = "\d+";/.exec(body);
							const steamId = steamIdMatch?.at(0).replace('g_steamID = ', '').replaceAll('"', '').replaceAll(';', '');
							const webAPITokenMatch = /data-loyalty_webapi_token="&quot;([a-zA-Z0-9_.-]+)&quot;"/.exec(body);
							const token = webAPITokenMatch[1];
							return {
								token,
								steamId,
							}
						}
					}, (results) => {
						// console.log(results)
						if (chrome.runtime.lastError) {
							reject(new Error(chrome.runtime.lastError.message));
							return;
						}

						const result = results?.[0]?.result;
						if (!result || !result.token || !result.steamId) {
							reject(new Error('Failed to parse steam data'));
							return;
						}

						chrome.tabs.remove(tab.id);
						resolve(result);
					});
				}
			});
		});
	});
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
	const API_URL = `https://cspricebase.com/api/get-rollhelper-prices/`;
	const EXTENSION_CACHE_DURATION = 20 * 60 * 1000;

	const { pricing_timestamp, pricing_etag, pricing_data, apiKey } =
		await chrome.storage.local.get([
			'pricing_timestamp',
			'pricing_etag',
			'pricing_data',
			'apiKey'
		]);

	if (!apiKey) return;

	const headers = {
		Authorization: `Bearer ${apiKey}`
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

	// todo: optimize the query only for neccessary data
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
					...User
					__typename
				  }
				}
				
				fragment User on User {
				  steamAccessToken
				  steamAccessTokenExpiresAt
				  id
				  name
				  email
				  verified
				  currency
				  createdAt
				  acceptTos
				  avatar
				  steamId
				  mutedUntil
				  userProgress {
					id
					xp
					requiredXp
					nextRequiredXp
					level
					__typename
				  }
				  unlockedChat
				  lastDepositAt
				  stickyReferee
				  steamApiKey
				  steamTradeUrl
				  verificationStatus
				  totalDeposit
				  dailyWithdrawLimit
				  preferences {
					...UserPreferences
					__typename
				  }
				  referralPromoCode {
					id
					code
					__typename
				  }
				  team {
					id
					name
					__typename
				  }
				  tickets {
					total
					__typename
				  }
				  wallets {
					...Wallet
					__typename
				  }
				  market {
					id
					slug
					name
					__typename
				  }
				  trader
				  suspectedTrader
				  microphoneEnabled
				  __typename
				}
				
				fragment UserPreferences on UserPreferences {
				  id
				  name
				  lastName
				  address1
				  address2
				  postcode
				  region
				  city
				  country {
					code
					name
					__typename
				  }
				  birthDate
				  gender
				  phone
				  __typename
				}
				
				fragment Wallet on Wallet {
				  id
				  name
				  amount
				  currency
				  __typename
				}`
				})
			})
				.then(res => {
					let data = res.json()
					return data;
				})
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
				try{
					let { token, steamId } = await getSteamData();
					if (!token || !steamId) {
						console.log('NO TOKEN OR STEAMID - Sending error response');
						sendResponse({ error: "Failed to get steam data. Are you logged in steam?" });
						return;
					}
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
									steamId: steamId,
									accessToken: token
								}
							},
							operationName: "changeSteamAccessToken"
						})
					});

					const data = await res.json();
					sendResponse(data);

				}	catch (error) {
					console.log(error)
					sendResponse({ error: error.message });
				}
			})()

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
			let offerMsg = msg.offerMsg;
			const steamTradeUrl = msg.tradeLink;
			const assetID = msg.assetID;
			let tradelinkOffer = '';

			if (
				offerMsg === undefined ||
				offerMsg === null ||
				offerMsg === ' ' ||
				offerMsg === ''
			) {
				tradelinkOffer = `${steamTradeUrl}&csgotrader_send=your_id_730_2_${assetID}`;
			} else {
				let encodedMsg = encodeURIComponent(offerMsg);
				tradelinkOffer = `${steamTradeUrl}&csgotrader_send=your_id_730_2_${assetID}&csgotrader_message=${encodedMsg}`;
			}

			chrome.tabs.create({ url: tradelinkOffer });
			return true;

		case 'cspricebase':
			(async () => {
				try {
					const API_URL = `https://cspricebase.com/api/get-rollhelper-prices/`;

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