activeWs = new Set();

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
