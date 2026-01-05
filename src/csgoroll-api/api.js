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
			resolve({ userID });
		});
	});
}

const applyPromo = async () => {
	chrome.runtime.sendMessage({action: "applyPromoApi", domain: domainUrl}, response => {
	});
};