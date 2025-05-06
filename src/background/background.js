activeWs = new Set();

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
    ...User
    __typename
  }
}

fragment User on User {
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
  roles
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
						'Referer': 'https://www.csgoroll.com/'
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
						extensions: {
							persistedQuery: {
								version: 1,
								sha256Hash: '702aae3857209cd68b579d3fb90c9ce0574be938fb4871ad5926a1fa2c2d6b21',
							},
						},
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
							if (invFailFetchCount <= 3) {
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
		// Initialize default storage values
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

		case 'pricempire':
			const apiKey = msg.key;

			if (apiKey === null) {
				sendResponse({ error: 'APIKEY for pricempire not found.' });
				return;
			}

			try {
				const priceProviderURL = `https://api.pricempire.com/v3/getAllItems?sources=buff&api_key=${apiKey}`;

				fetch(priceProviderURL)
					.then(res => res.json())
					.then(data => {
						sendResponse(data);
					})
					.catch(error => {
						sendResponse({ error: 'Failed to load pricempire prices' });
					});
				return true;
			} catch (e) {
				console.error('Unexpected error:', e);
				sendResponse({ error: 'Unexpected error' });
			}
			break;

		case 'open_ws':
			let id = msg.userid;

			if (activeWs.has(id)) sendResponse(false);

			activeWs.add(id);
			sendResponse(true);
			break;
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