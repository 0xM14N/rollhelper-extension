const updateSettings = async () => {
	const [
		{ steamOfferMessage },
		{ wantSendOffers },
		{ wantCompletedAlert },
		{ wantCooldownAlert },
		{ dcNotifyState },
		{ wantWithdrawalAlert },
		{ wantDepoAlert },
		{ cspApi },
		{ switchDepoState },
		{ switchNotifyState },
		{ token },
		{ userkey },
		{ webhook },
		{ enablePricingOverlay },
		{ depoPushoverPriority },
		{ withdrawPushoverPriority },
		{ cooldownPushoverPriority },
		{ completedPushoverPriority },
		{ reversalPushoverPriority },
		{ protectedPushoverPriority },
		{ wantReversalAlert },
		{ wantProtectedAlert },

	] = await Promise.all([
		chrome.storage.sync.get(['steamOfferMessage']),
		chrome.storage.sync.get(['wantSendOffers']),
		chrome.storage.sync.get(['wantCompletedAlert']),
		chrome.storage.sync.get(['wantCooldownAlert']),
		chrome.storage.sync.get(['dcNotifyState']),
		chrome.storage.sync.get(['wantWithdrawalAlert']),
		chrome.storage.sync.get(['wantDepoAlert']),
		chrome.storage.sync.get(['cspApi']),
		chrome.storage.sync.get(['switchDepoState']),
		chrome.storage.sync.get(['switchNotifyState']),
		chrome.storage.sync.get(['token']),
		chrome.storage.sync.get(['userkey']),
		chrome.storage.sync.get(['webhook']),
		chrome.storage.sync.get(['enablePricingOverlay']),
		chrome.storage.sync.get(['depoPushoverPriority']),
		chrome.storage.sync.get(['withdrawPushoverPriority']),
		chrome.storage.sync.get(['cooldownPushoverPriority']),
		chrome.storage.sync.get(['completedPushoverPriority']),
		chrome.storage.sync.get(['reversalPushoverPriority']),
		chrome.storage.sync.get(['protectedPushoverPriority']),
		chrome.storage.sync.get(['wantReversalAlert']),
		chrome.storage.sync.get(['wantProtectedAlert']),
	]);

	offerMessage = steamOfferMessage;
	sendSteamOffers = wantSendOffers;
	completedAlert = wantCompletedAlert;
	cooldownAlert = wantCooldownAlert;
	protectedAlert = wantProtectedAlert
	reversalAlert = wantReversalAlert
	discord = dcNotifyState;
	withdrawAlert = wantWithdrawalAlert;
	depoAlert = wantDepoAlert;
	cspApiKey = cspApi;
	depoAutoAccept = switchDepoState;
	Pushover = switchNotifyState;
	Token = token;
	Userkey = userkey;
	Webhook = webhook;
	enablePricing = enablePricingOverlay;

	depositNotifPriority = depoPushoverPriority
	withdrawNotifPriority = withdrawPushoverPriority
	cooldownNotifPriority = cooldownPushoverPriority
	completedNotifPriority = completedPushoverPriority
	reversalNotifPriority =  reversalPushoverPriority
	protectedNotifPriority = protectedPushoverPriority
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

	if (msg.cspApi) {
		chrome.storage.sync.set({ cspApi: msg.cspApi }).then(() => {
			cspApiKey = msg.cspApi;
			loadCSP();
			updateSettings();
		});
	}

	if (msg.update) {
		updateSettings();
	}
});
