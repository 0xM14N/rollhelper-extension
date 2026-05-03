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
		{ trackingApiKey },
		{ enableTracking },
		{ wantAutoCancelOffers },
		{ wantEmergencyAlerts },
		{ wantAutoRelist },
		{ wantAutoTokenUpdate },
		{ wantMarkupDecay },
		{ markupDecayPercent: storedDecayPercent },
		{ markupDecayInterval: storedDecayInterval },
		{ markupDecayFloor: storedDecayFloor },
		{ wantItemDecay },
		{ itemDecayPercent: storedItemDecayPercent },
		{ itemDecayInterval: storedItemDecayInterval },
		{ itemDecayFloor: storedItemDecayFloor },
		{ wantDepositSafeguard },
		{ safeguardThresholdVal },
		{ safeguardMarketVal },
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
		chrome.storage.sync.get(['trackingApiKey']),
		chrome.storage.sync.get(['enableTracking']),
		chrome.storage.sync.get(['wantAutoCancelOffers']),
		chrome.storage.sync.get(['wantEmergencyAlerts']),
		chrome.storage.sync.get(['wantAutoRelist']),
		chrome.storage.sync.get(['wantAutoTokenUpdate']),
		chrome.storage.sync.get(['wantMarkupDecay']),
		chrome.storage.sync.get(['markupDecayPercent']),
		chrome.storage.sync.get(['markupDecayInterval']),
		chrome.storage.sync.get(['markupDecayFloor']),
		chrome.storage.sync.get(['wantItemDecay']),
		chrome.storage.sync.get(['itemDecayPercent']),
		chrome.storage.sync.get(['itemDecayInterval']),
		chrome.storage.sync.get(['itemDecayFloor']),
		chrome.storage.sync.get(['wantDepositSafeguard']),
		chrome.storage.sync.get(['safeguardThresholdVal']),
		chrome.storage.sync.get(['safeguardMarketVal']),
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

	trackingKey = trackingApiKey
	wantTracking = enableTracking
	autoCancelOffers = wantAutoCancelOffers
	emergencyAlerts = wantEmergencyAlerts
	autoRelist = wantAutoRelist
	autoTokenUpdate = wantAutoTokenUpdate ?? true
	markupDecayEnabled = wantMarkupDecay
	markupDecayAmount = Number(storedDecayPercent) || 10
	markupDecayIntervalHours = Number(storedDecayInterval) || 4
	markupDecayMinPercent = Number(storedDecayFloor) || 50
	itemDecayEnabled = wantItemDecay
	itemDecayAmount = Number(storedItemDecayPercent) || 1
	itemDecayIntervalHours = Number(storedItemDecayInterval) || 6
	itemDecayMinPercent = Number(storedItemDecayFloor) || 75
	depositSafeguard = wantDepositSafeguard
	safeguardThreshold = Number(safeguardThresholdVal) || 5
	safeguardMarket = safeguardMarketVal || 'buff'
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