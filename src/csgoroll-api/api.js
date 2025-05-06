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
	chrome.runtime.sendMessage({action: "getUserID", domain: domainUrl}, response => {
		userID = response.data.currentUser.id;
	});
}

const applyPromo = async () => {
	chrome.runtime.sendMessage({action: "applyPromoApi", domain: domainUrl}, response => {
	});
};