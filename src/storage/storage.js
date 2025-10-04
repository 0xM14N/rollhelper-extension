const updateSettings = async () => {
	const [
		{ steamOfferMessage },
		{ wantSendOffers },
		{ wantCompletedAlert },
		{ wantCooldownAlert },
		{ dcNotifyState },
		{ wantWithdrawalAlert },
		{ wantDepoAlert },
		{ peApi },
		{ switchDepoState },
		{ switchNotifyState },
		{ token },
		{ userkey },
		{ webhook },
	] = await Promise.all([
		chrome.storage.sync.get(['steamOfferMessage']),
		chrome.storage.sync.get(['wantSendOffers']),
		chrome.storage.sync.get(['wantCompletedAlert']),
		chrome.storage.sync.get(['wantCooldownAlert']),
		chrome.storage.sync.get(['dcNotifyState']),
		chrome.storage.sync.get(['wantWithdrawalAlert']),
		chrome.storage.sync.get(['wantDepoAlert']),
		chrome.storage.sync.get(['peApi']),
		chrome.storage.sync.get(['switchDepoState']),
		chrome.storage.sync.get(['switchNotifyState']),
		chrome.storage.sync.get(['token']),
		chrome.storage.sync.get(['userkey']),
		chrome.storage.sync.get(['webhook']),
	]);

	// console.log("steamOfferMessage:", steamOfferMessage);
	// console.log("wantSendOffers:", wantSendOffers);
	// console.log("wantCompletedAlert:", wantCompletedAlert);
	// console.log("wantCooldownAlert:", wantCooldownAlert);
	// console.log("dcNotifyState:", dcNotifyState);
	// console.log("wantWithdrawalAlert:", wantWithdrawalAlert);
	// console.log("wantDepoAlert:", wantDepoAlert);
	// console.log("peApi:", peApi);
	// console.log("switchDepoState:", switchDepoState);
	// console.log("switchNotifyState:", switchNotifyState);
	// console.log("token:", token);
	// console.log("userkey:", userkey);
	// console.log("webhook:", webhook);

	offerMessage = steamOfferMessage;
	sendSteamOffers = wantSendOffers;
	completedAlert = wantCompletedAlert;
	cooldownAlert = wantCooldownAlert;
	discord = dcNotifyState;
	withdrawAlert = wantWithdrawalAlert;
	depoAlert = wantDepoAlert;
	peApiKey = peApi;
	depoAutoAccept = switchDepoState;
	Pushover = switchNotifyState;
	Token = token;
	Userkey = userkey;
	Webhook = webhook;

	// Console logs for each variable
	// console.log('steamOfferMessage:', steamOfferMessage);
	// console.log('wantSendOffers:', wantSendOffers);
	// console.log('wantCompletedAlert:', wantCompletedAlert);
	// console.log('wantCooldownAlert:', wantCooldownAlert);
	// console.log('dcNotifyState:', dcNotifyState);
	// console.log('wantWithdrawalAlert:', wantWithdrawalAlert);
	// console.log('wantDepoAlert:', wantDepoAlert);
	// console.log('peApi:', peApi);
	// console.log('switchDepoState:', switchDepoState);
	// console.log('switchNotifyState:', switchNotifyState);
	// console.log('token:', token);
	// console.log('userkey:', userkey);
	// console.log('webhook:', webhook);
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if (msg?.wantCooldownAlert !== undefined) {
		chrome.storage.sync
			.set({ wantCooldownAlert: msg.wantCooldownAlert })
			.then(() => {
				updateSettings();
			});
	}

	if (msg?.wantCompletedAlert !== undefined) {
		chrome.storage.sync
			.set({ wantCompletedAlert: msg.wantCompletedAlert })
			.then(() => {
				updateSettings();
			});
	}

	if (msg?.wantWithdrawalAlert !== undefined) {
		chrome.storage.sync
			.set({ wantWithdrawalAlert: msg.wantWithdrawalAlert })
			.then(() => {
				updateSettings();
			});
	}

	if (msg?.wantDepoAlert !== undefined) {
		chrome.storage.sync.set({ wantDepoAlert: msg.wantDepoAlert }).then(() => {
			updateSettings();
		});
	}

	if (msg.peApi) {
		if (msg.peApi.length != 36) {
			alert(`Please enter valid pricempire API KEY`);
			console.log(
				`%c[ROLLHELOPER] -> Please enter valid pricempire API KEY`,
				errorCSSlog,
			);
			chrome.storage.sync.set({ peApi: null }).then(() => {
				updateSettings();
			});
		} else {
			chrome.storage.sync.set({ peApi: msg.peApi }).then(() => {
				peApiKey = msg.peApi;
				loadPriceDataPricempire();
				updateSettings();
			});
		}
	}

	if (msg.update) {
		updateSettings();
	}
});
