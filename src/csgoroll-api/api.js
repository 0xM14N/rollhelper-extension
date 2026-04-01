const fetchAcceptTrade = async (tradeid) => {
	chrome.runtime.sendMessage({action: "fetchAcceptTrade", domain: domainUrl, tradeid: tradeid}, response => {
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

			steam_access_token = response.data.currentUser.steamAccessToken;
			token_expiration = response.data.currentUser.steamAccessTokenExpiresAt;

			chrome.storage.sync.set({ currentUserId: userID })
			resolve({ userID, token_expiration });
		});
	});
}

const updateAccessToken = async () => {
	chrome.runtime.sendMessage({type: "updateAccessToken", domain: domainUrl}, async response => {
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
	});
};


const applyPromo = async () => {
	chrome.runtime.sendMessage({action: "applyPromoApi", domain: domainUrl}, response => {});
};