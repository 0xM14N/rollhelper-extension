const fetchAcceptTrade = (tradeid) => {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage({action: "fetchAcceptTrade", domain: domainUrl, tradeid: tradeid}, response => {
			if (!response) {
				reject(new Error('No response from background script'));
				return;
			}
			if (response.error) {
				reject(new Error(response.error));
				return;
			}
			resolve(response);
		});
	});
};

const getCurrentSteamInvData = async (userID) => {
	chrome.runtime.sendMessage({action: "getCurrentSteamInvData", domain: domainUrl, userID: userID}, response => {
		itemsList = response;
	});
};

async function getUserID() {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage({action: "getUserID", domain: domainUrl}, response => {
			if (!response) {
				reject(new Error("No response from background script"));
				return;
			}

			if (response.error) {
				reject(new Error(response.error));
				return;
			}

			userID = response.data.currentUser.id;
			steamId = response.data.currentUser.steamId;

			steam_access_token = response.data.currentUser.steamAccessToken;
			token_expiration = response.data.currentUser.steamAccessTokenExpiresAt;

			chrome.storage.sync.set({ currentUserId: userID })
			resolve({ userID, token_expiration, steamId });
		});
	});
}

const updateAccessToken = async () => {
	chrome.runtime.sendMessage({type: "updateAccessToken", domain: domainUrl, steamId: steamId}, async response => {
		if (!response) {
			token_steam_update_errors++;
			console.log(`[STEAM_TOKEN_UPDATE_ERROR]: No response received from background script`)
			sendPushoverNotification(`[STEAM_TOKEN_UPDATE_ERROR]: No response received from background script`);
			return;
		}

		if (response.error) {
			token_steam_update_errors++;
			console.log(`[STEAM_TOKEN_UPDATE_ERROR]: ${response.error}`)
			sendPushoverNotification(`[STEAM_TOKEN_UPDATE_ERROR]: ${response.error}`);
			return;
		}

		console.log('[STEAM_TOKEN_UPDATED]: The token has been successfully updated.')

		try {
			await getUserID();
			token_steam_update_errors = 0;
		} catch (e) {
			console.log(`[STEAM_TOKEN_UPDATE]: Token updated but failed to refresh local state: ${e.message}`);
		}
	});
};


const fetchUserListedTrades = () => {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage({
			action: 'fetchUserListedTrades',
			domain: domainUrl,
			userId: userID,
		}, response => {
			if (!response) {
				reject(new Error('No response from background script'));
				return;
			}
			if (response.error) {
				reject(new Error(response.error));
				return;
			}
			resolve(response);
		});
	});
};

const cancelCsgorollTrade = (tradeId) => {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage({
			action: 'cancelCsgorollTrade',
			domain: domainUrl,
			tradeId,
		}, response => {
			if (!response) {
				reject(new Error('No response from background script'));
				return;
			}
			if (response.error) {
				reject(new Error(response.error));
				return;
			}
			if (response.data?.cancelTrade?.trade) {
				resolve(response.data.cancelTrade.trade);
			} else {
				reject(new Error(JSON.stringify(response.errors || response)));
			}
		});
	});
};

const relistDeposit = (assetId, itemVariantId, value) => {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage({
			action: 'relistDeposit',
			domain: domainUrl,
			assetId,
			itemVariantId,
			value,
		}, response => {
			if (!response) {
				reject(new Error('No response from background script'));
				return;
			}
			if (response.error) {
				reject(new Error(response.error));
				return;
			}
			if (response.data?.createTrades?.trades?.length > 0) {
				resolve(response.data.createTrades.trades[0]);
			} else {
				reject(new Error(JSON.stringify(response.errors || response)));
			}
		});
	});
};

const applyPromo = async () => {
	chrome.runtime.sendMessage({action: "applyPromoApi", domain: domainUrl}, response => {});
};