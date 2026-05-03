// === Navigation ===
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
	item.addEventListener('click', () => {
		document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
		document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
		item.classList.add('active');
		document.getElementById('page-' + item.dataset.page).classList.add('active');
	});
});

// === Elements: Trades ===
let saveBtn = document.getElementById('saveSettings');
let switchDepo = document.getElementById('depoSwitch');
let sendOfferSwitch = document.getElementById('sendOfferSwitch');
let autoCancelSwitch = document.getElementById('autoCancelSwitch');
let autoRelistSwitch = document.getElementById('autoRelistSwitch');
let autoTokenSwitch = document.getElementById('autoTokenSwitch');
let steamMsgInput = document.getElementById('steamOfferMessageInput');
let sessionBtn = document.getElementById('copy-session-btn');

// === Elements: Deposits ===
let saveDepositsBtn = document.getElementById('saveDeposits');
let markupDecaySwitch = document.getElementById('markupDecaySwitch');
let decayPercentInput = document.getElementById('decayPercent');
let decayIntervalInput = document.getElementById('decayInterval');
let decayFloorInput = document.getElementById('decayFloor');
let itemDecaySwitch = document.getElementById('itemDecaySwitch');
let itemDecayPercentInput = document.getElementById('itemDecayPercent');
let itemDecayIntervalInput = document.getElementById('itemDecayInterval');
let itemDecayFloorInput = document.getElementById('itemDecayFloor');
let safeguardSwitchEl = document.getElementById('safeguardSwitch');
let safeguardThresholdInput = document.getElementById('safeguardThreshold');
let safeguardMarketSelect = document.getElementById('safeguardMarket');

// === Elements: Notifications ===
let switchNotify = document.getElementById('notifySwitch');
let dcNotify = document.getElementById('dcNotifySwitch');
let depoAlertSwitch = document.getElementById('depoAlert');
let withdrawalSwitch = document.getElementById('withdrawAlert');
let completedSwitch = document.getElementById('completedAlert');
let cooldownSwitch = document.getElementById('cooldownAlert');
let protectedSwitch = document.getElementById('protectedAlert');
let reversalSwitch = document.getElementById('reversalAlert');
let emergencySwitch = document.getElementById('emergencySwitch');
let depositPriorityInput = document.getElementById('depoPriority');
let withdrawPriorityInput = document.getElementById('withdrawPriority');
let cooldownPriorityInput = document.getElementById('cooldownPriority');
let completedPriorityInput = document.getElementById('completedPriority');
let protectedPriorityInput = document.getElementById('protectedPriority');
let reversalPriorityInput = document.getElementById('reversalPriority');
let inputUsrkey = document.getElementById('userkeyInput');
let inputToken = document.getElementById('tokenInput');
let dcWebhook = document.getElementById('discordInput');
let saveNotifBtn = document.getElementById('saveNotifications');

// === Elements: Dashboard ===
let trackingKeyInput = document.getElementById('cspTrackingKey');
let trackingSwitch = document.getElementById('trackingSwitch');
let saveTrackingBtn = document.getElementById('saveTracking');

// === Elements: Pricing ===
let cspApiKeyInput = document.getElementById('cspApiKey');
let pricingSwitch = document.getElementById('pricingOverlay');
let savePricingBtn = document.getElementById('savePricing');

// === Init ===
document.addEventListener('DOMContentLoaded', restoreAll);

// === Session Cookie ===
sessionBtn.addEventListener('click', () => {
	chrome.runtime.sendMessage({ type: 'getSessionCookie' }, async (response) => {
		if (response && response.session) {
			try {
				await navigator.clipboard.writeText(response.session);
				alert('Session cookie copied!\nKeep this cookie secure.\nNEVER SHARE it with untrusted sources.');
			} catch (err) {
				console.error('Failed to copy cookie:', err);
			}
		} else {
			alert('No session cookie found');
		}
	});
});

// =====================
// TRADES PAGE
// =====================
saveBtn.addEventListener('click', async function () {
	let val = steamMsgInput.value;
	if (val !== '') {
		await chrome.storage.sync.set({ steamOfferMessage: val });
	}
	await callUpdateStorage();
	flashSaved(saveBtn);
});

sendOfferSwitch.addEventListener('change', function () {
	chrome.storage.sync.set({
		wantSendOffersState: this.checked,
		wantSendOffers: this.checked,
	}, () => callUpdateStorage());
});

autoCancelSwitch.addEventListener('change', function () {
	chrome.storage.sync.set({
		wantAutoCancelOffersState: this.checked,
		wantAutoCancelOffers: this.checked,
	}, () => callUpdateStorage());
});

autoRelistSwitch.addEventListener('change', function () {
	chrome.storage.sync.set({
		wantAutoRelistState: this.checked,
		wantAutoRelist: this.checked,
	}, () => callUpdateStorage());
});

autoTokenSwitch.addEventListener('change', function () {
	chrome.storage.sync.set({
		wantAutoTokenUpdateState: this.checked,
		wantAutoTokenUpdate: this.checked,
	}, () => callUpdateStorage());
});

switchDepo.addEventListener('change', function () {
	chrome.storage.sync.set({ switchDepoState: this.checked }, () => callUpdateStorage());
});

// =====================
// DEPOSITS PAGE
// =====================
markupDecaySwitch.addEventListener('change', function () {
	chrome.storage.sync.set({
		wantMarkupDecayState: this.checked,
		wantMarkupDecay: this.checked,
	}, () => callUpdateStorage());
});

itemDecaySwitch.addEventListener('change', function () {
	chrome.storage.sync.set({
		wantItemDecayState: this.checked,
		wantItemDecay: this.checked,
	}, () => callUpdateStorage());
});

safeguardSwitchEl.addEventListener('change', function () {
	chrome.storage.sync.set({
		wantDepositSafeguardState: this.checked,
		wantDepositSafeguard: this.checked,
	}, () => callUpdateStorage());
});

saveDepositsBtn.addEventListener('click', async function () {
	await chrome.storage.sync.set({
		markupDecayPercent: decayPercentInput.value,
		markupDecayInterval: decayIntervalInput.value,
		markupDecayFloor: decayFloorInput.value,
		itemDecayPercent: itemDecayPercentInput.value,
		itemDecayInterval: itemDecayIntervalInput.value,
		itemDecayFloor: itemDecayFloorInput.value,
		safeguardThresholdVal: safeguardThresholdInput.value,
		safeguardMarketVal: safeguardMarketSelect.value,
	});
	await callUpdateStorage();
	flashSaved(saveDepositsBtn);
});

// =====================
// NOTIFICATIONS PAGE
// =====================
switchNotify.addEventListener('change', function () {
	chrome.storage.sync.set({ switchNotifyState: this.checked }, () => callUpdateStorage());
});

dcNotify.addEventListener('change', function () {
	chrome.storage.sync.set({ dcNotifyState: this.checked }, () => callUpdateStorage());
});

depoAlertSwitch.addEventListener('change', function () {
	chrome.storage.sync.set({
		depoAlertSwitchState: this.checked,
		wantDepoAlert: this.checked,
	}, () => callUpdateStorage());
});

withdrawalSwitch.addEventListener('change', function () {
	chrome.storage.sync.set({
		withdrawAlertSwitchState: this.checked,
		wantWithdrawalAlert: this.checked,
	}, () => callUpdateStorage());
});

completedSwitch.addEventListener('change', function () {
	chrome.storage.sync.set({
		completedAlertSwitchState: this.checked,
		wantCompletedAlert: this.checked,
	}, () => callUpdateStorage());
});

cooldownSwitch.addEventListener('change', function () {
	chrome.storage.sync.set({
		cooldownSwitchState: this.checked,
		wantCooldownAlert: this.checked,
	}, () => callUpdateStorage());
});

protectedSwitch.addEventListener('change', function () {
	chrome.storage.sync.set({ wantProtectedAlert: this.checked }, () => callUpdateStorage());
});

reversalSwitch.addEventListener('change', function () {
	chrome.storage.sync.set({ wantReversalAlert: this.checked }, () => callUpdateStorage());
});

emergencySwitch.addEventListener('change', function () {
	chrome.storage.sync.set({
		wantEmergencyAlerts: this.checked,
	}, () => callUpdateStorage());
});

saveNotifBtn.addEventListener('click', async function () {
	const settings = {
		depoPushoverPriority: depositPriorityInput.value,
		withdrawPushoverPriority: withdrawPriorityInput.value,
		cooldownPushoverPriority: cooldownPriorityInput.value,
		completedPushoverPriority: completedPriorityInput.value,
		protectedPushoverPriority: protectedPriorityInput.value,
		reversalPushoverPriority: reversalPriorityInput.value,
		switchNotifyState: switchNotify.checked,
		dcNotifyState: dcNotify.checked,
	};
	if (inputToken.value !== '') settings.token = inputToken.value;
	if (inputUsrkey.value !== '') settings.userkey = inputUsrkey.value;
	if (dcWebhook.value !== '') settings.webhook = dcWebhook.value;

	await chrome.storage.sync.set(settings);
	await callUpdateStorage();
	if (inputToken.value !== '') { inputToken.value = ''; inputToken.placeholder = '*******'; }
	if (inputUsrkey.value !== '') { inputUsrkey.value = ''; inputUsrkey.placeholder = '*******'; }
	if (dcWebhook.value !== '') { dcWebhook.value = ''; dcWebhook.placeholder = '*******'; }
	flashSaved(saveNotifBtn);
});

// =====================
// DASHBOARD PAGE
// =====================
trackingSwitch.addEventListener('change', function () {
	chrome.storage.sync.set({ enableTracking: this.checked }, () => callUpdateStorage());
});

saveTrackingBtn.addEventListener('click', async function () {
	const settings = { enableTracking: trackingSwitch.checked };
	if (trackingKeyInput.value !== '') settings.trackingApiKey = trackingKeyInput.value;
	await chrome.storage.sync.set(settings);
	await callUpdateStorage();
	if (trackingKeyInput.value !== '') { trackingKeyInput.value = ''; trackingKeyInput.placeholder = '*******'; }
	flashSaved(saveTrackingBtn);
});

// =====================
// PRICING PAGE
// =====================
pricingSwitch.addEventListener('change', function () {
	chrome.storage.sync.set({ enablePricingOverlay: this.checked }, () => callUpdateStorage());
});

savePricingBtn.addEventListener('click', async function () {
	const settings = { enablePricingOverlay: pricingSwitch.checked };
	if (cspApiKeyInput.value !== '') settings.cspApi = cspApiKeyInput.value;
	await chrome.storage.sync.set(settings);
	await callUpdateStorage();
	if (cspApiKeyInput.value !== '') { cspApiKeyInput.value = ''; cspApiKeyInput.placeholder = '*******'; }
	flashSaved(savePricingBtn);
});

// =====================
// RESTORE ALL
// =====================
function restoreAll() {
	chrome.storage.sync.get([
		'switchDepoState', 'wantSendOffersState', 'wantAutoCancelOffersState', 'wantAutoRelistState', 'wantAutoTokenUpdateState',
		'wantMarkupDecayState', 'markupDecayPercent', 'markupDecayInterval', 'markupDecayFloor',
		'wantItemDecayState', 'itemDecayPercent', 'itemDecayInterval', 'itemDecayFloor',
		'wantDepositSafeguardState', 'safeguardThresholdVal', 'safeguardMarketVal',
		'steamOfferMessage',
		'switchNotifyState', 'dcNotifyState',
		'depoAlertSwitchState', 'withdrawAlertSwitchState', 'completedAlertSwitchState', 'cooldownSwitchState',
		'wantProtectedAlert', 'wantReversalAlert',
		'depoPushoverPriority', 'withdrawPushoverPriority', 'cooldownPushoverPriority',
		'completedPushoverPriority', 'protectedPushoverPriority', 'reversalPushoverPriority',
		'wantEmergencyAlerts',
		'token', 'userkey', 'webhook',
		'trackingApiKey', 'enableTracking',
		'cspApi', 'enablePricingOverlay'
	]).then(res => {
		// Trades
		switchDepo.checked = res.switchDepoState;
		sendOfferSwitch.checked = res.wantSendOffersState;
		autoCancelSwitch.checked = res.wantAutoCancelOffersState;
		autoRelistSwitch.checked = res.wantAutoRelistState;
		autoTokenSwitch.checked = res.wantAutoTokenUpdateState ?? true;
		markupDecaySwitch.checked = res.wantMarkupDecayState;
		decayPercentInput.value = res.markupDecayPercent ?? 10;
		decayIntervalInput.value = res.markupDecayInterval ?? 4;
		decayFloorInput.value = res.markupDecayFloor ?? 50;
		itemDecaySwitch.checked = res.wantItemDecayState;
		itemDecayPercentInput.value = res.itemDecayPercent ?? 1;
		itemDecayIntervalInput.value = res.itemDecayInterval ?? 6;
		itemDecayFloorInput.value = res.itemDecayFloor ?? 75;
		safeguardSwitchEl.checked = res.wantDepositSafeguardState;
		safeguardThresholdInput.value = res.safeguardThresholdVal ?? 5;
		safeguardMarketSelect.value = res.safeguardMarketVal || 'buff';
		steamMsgInput.placeholder = res.steamOfferMessage || 'Enter your message...';

		// Notifications
		switchNotify.checked = res.switchNotifyState;
		dcNotify.checked = res.dcNotifyState;
		depoAlertSwitch.checked = res.depoAlertSwitchState;
		withdrawalSwitch.checked = res.withdrawAlertSwitchState;
		completedSwitch.checked = res.completedAlertSwitchState;
		cooldownSwitch.checked = res.cooldownSwitchState;
		protectedSwitch.checked = res.wantProtectedAlert;
		reversalSwitch.checked = res.wantReversalAlert;
		emergencySwitch.checked = res.wantEmergencyAlerts;

		depositPriorityInput.value = res.depoPushoverPriority ?? 0;
		withdrawPriorityInput.value = res.withdrawPushoverPriority ?? 0;
		cooldownPriorityInput.value = res.cooldownPushoverPriority ?? 0;
		completedPriorityInput.value = res.completedPushoverPriority ?? 0;
		protectedPriorityInput.value = res.protectedPushoverPriority ?? 0;
		reversalPriorityInput.value = res.reversalPushoverPriority ?? 0;

		inputToken.placeholder = res.token ? '*******' : 'Pushover Token';
		inputUsrkey.placeholder = res.userkey ? '*******' : 'Pushover User Key';
		dcWebhook.placeholder = res.webhook ? '*******' : 'Discord Webhook URL';

		// Dashboard
		trackingKeyInput.placeholder = res.trackingApiKey ? '*******' : 'TRACKING-KEY';
		trackingSwitch.checked = res.enableTracking;

		// Pricing
		cspApiKeyInput.placeholder = res.cspApi ? '*******' : 'API-KEY';
		pricingSwitch.checked = res.enablePricingOverlay;
	});
}

function callUpdateStorage() {
	return new Promise((resolve) => {
		chrome.tabs.query({
			url: [
				'https://www.csgoroll.com/*',
				'https://www.csgoroll.gg/*',
				'https://www.csgorolltr.com/*',
			],
		}, (tabs) => {
			if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
				resolve();
				return;
			}
			let pending = tabs.length;
			const done = () => { if (--pending <= 0) resolve(); };
			for (const tab of tabs) {
				try {
					chrome.tabs.sendMessage(tab.id, { update: true }, () => {
						void chrome.runtime.lastError;
						done();
					});
				} catch (_) {
					done();
				}
			}
		});
	});
}

function flashSaved(btn) {
	if (!btn) { window.close(); return; }
	const span = btn.querySelector('span');
	const original = span ? span.textContent : btn.textContent;
	if (span) span.textContent = 'Saved!'; else btn.textContent = 'Saved!';
	btn.disabled = true;
	setTimeout(() => {
		if (span) span.textContent = original; else btn.textContent = original;
		btn.disabled = false;
		window.close();
	}, 600);
}
