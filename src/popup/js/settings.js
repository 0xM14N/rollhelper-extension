let saveBtn = document.getElementById('saveSettings');
let inputUsrkey = document.getElementById('userkeyInput');
let inputToken = document.getElementById('tokenInput');
let dcWebhook = document.getElementById('discordInput');
let dcRow = document.getElementsByClassName('discordInput')[0];
let pushoverRow = document.getElementsByClassName('pushoverInput')[0];
let switchNotify = document.getElementById('notifySwitch');
let dcNotify = document.getElementById('dcNotifySwitch');
let notifBox = document.getElementsByClassName('notif-box')[0];
let alertBox = document.getElementsByClassName('alert-set-box')[0];
let depoAlertSwitch = document.getElementById('depoAlert');
let withdrawalSwitch = document.getElementById('withdrawAlert');
let completedSwitch = document.getElementById('completedAlert');
let cooldownSwitch = document.getElementById('cooldownAlert');
let depositPriorityInput = document.getElementById("depoPriority")
let withdrawPriorityInput = document.getElementById("withdrawPriority")
let cooldownPriorityInput = document.getElementById("cooldownPriority")
let completedPriorityInput = document.getElementById("completedPriority")
let protectedPriorityInput = document.getElementById("protectedPriority")
let reversalPriorityInput = document.getElementById("reversalPriority")
let protectedSwitch = document.getElementById('protectedAlert');
let reversalSwitch = document.getElementById('reversalAlert');


// RESTORE THE UI
document.addEventListener('DOMContentLoaded', function () {
	restoreOptions();
});

saveBtn.addEventListener('click', async function () {
	let promiseStore = [];

	let userkeyValue = inputUsrkey.value;
	let tokenValue = inputToken.value;
	let webhookValue = dcWebhook.value;

	// pushover priority
	let depoPushoverPriority = depositPriorityInput.value;
	let withdrawPushoverPriority = withdrawPriorityInput.value;
	let cooldownPushoverPriority = cooldownPriorityInput.value;
	let completedPushoverPriority = completedPriorityInput.value;
	let protectedPushoverPriority = protectedPriorityInput.value;
	let reversalPushoverPriority = reversalPriorityInput.value;


	promiseStore.push(chrome.storage.sync.set({ depoPushoverPriority: depoPushoverPriority }));
	promiseStore.push(chrome.storage.sync.set({ withdrawPushoverPriority: withdrawPushoverPriority }));
	promiseStore.push(chrome.storage.sync.set({ cooldownPushoverPriority: cooldownPushoverPriority }));
	promiseStore.push(chrome.storage.sync.set({ completedPushoverPriority: completedPushoverPriority }));

	promiseStore.push(chrome.storage.sync.set({ protectedPushoverPriority: protectedPushoverPriority }));
	promiseStore.push(chrome.storage.sync.set({ reversalPushoverPriority: reversalPushoverPriority }));

	if (tokenValue != '') {
		promiseStore.push(chrome.storage.sync.set({ token: tokenValue }));
	}

	if (userkeyValue != '') {
		promiseStore.push(chrome.storage.sync.set({ userkey: userkeyValue }));
	}

	if (webhookValue != '') {
		promiseStore.push(chrome.storage.sync.set({ webhook: webhookValue }));
	}

	await Promise.all(promiseStore);
	callUpdateStorage();

	window.close();
});


protectedSwitch.addEventListener('change', function () {
	if (this.checked) {
		// save state into storage
		chrome.storage.sync.set(
			{
				wantProtectedAlert: true,
			},
			() => callUpdateStorage(),
		);
	} else {
		// save state into storage
		chrome.storage.sync.set(
			{
				wantProtectedAlert: false,
			},
			() => callUpdateStorage(),
		);
	}
});


reversalSwitch.addEventListener('change', function () {
	if (this.checked) {
		// save state into storage
		chrome.storage.sync.set(
			{
				wantReversalAlert: true,
			},
			() => callUpdateStorage(),
		);
	} else {
		// save state into storage
		chrome.storage.sync.set(
			{
				wantReversalAlert: false,
			},
			() => callUpdateStorage(),
		);
	}
});


completedSwitch.addEventListener('change', function () {
	if (this.checked) {
		// save state into storage
		chrome.storage.sync.set(
			{
				completedAlertSwitchState: true,
				wantCompletedAlert: true,
			},
			() => callUpdateStorage(),
		);
	} else {
		// save state into storage
		chrome.storage.sync.set(
			{
				completedAlertSwitchState: false,
				wantCompletedAlert: false,
			},
			() => callUpdateStorage(),
		);
	}
});


cooldownSwitch.addEventListener('change', function () {
	if (this.checked) {
		// save state into storage
		chrome.storage.sync.set(
			{
				cooldownSwitchState: true,
				wantCooldownAlert: true,
			},
			() => callUpdateStorage(),
		);
	} else {
		// save state into storage
		chrome.storage.sync.set(
			{
				cooldownSwitchState: false,
				wantCooldownAlert: false,
			},
			() => callUpdateStorage(),
		);
	}
});


dcNotify.addEventListener('change', function () {
	if (this.checked) {
		chrome.storage.sync.set({
			dcNotifyState: true,
		});
	} else {
		chrome.storage.sync.set({
			dcNotifyState: false,
		});
	}
});


switchNotify.addEventListener('change', function () {
	if (this.checked) {
		chrome.storage.sync.set({
			switchNotifyState: true,
		});
	} else {
		chrome.storage.sync.set({
			switchNotifyState: false,
		});
	}
});


depoAlertSwitch.addEventListener('change', function () {
	if (this.checked) {
		// save state into storage
		chrome.storage.sync.set(
			{
				depoAlertSwitchState: true,
				wantDepoAlert: true,
			},
			() => callUpdateStorage(),
		);
	} else {
		// save state into storage
		chrome.storage.sync.set(
			{
				depoAlertSwitchState: false,
				wantDepoAlert: false,
			},
			() => callUpdateStorage(),
		);
	}
});


withdrawalSwitch.addEventListener('change', function () {
	if (this.checked) {
		// save state into storage
		chrome.storage.sync.set(
			{
				withdrawAlertSwitchState: true,
				wantWithdrawalAlert: true,
			},
			() => callUpdateStorage(),
		);
	} else {
		// save state into storage
		chrome.storage.sync.set(
			{
				withdrawAlertSwitchState: false,
				wantWithdrawalAlert: false,
			},
			() => callUpdateStorage(),
		);
	}
});

function restoreOptions() {
	chrome.storage.sync.get([
		'cooldownSwitchState',
		'completedAlertSwitchState',
		'dcNotifyState',
		'switchNotifyState',
		'token',
		'userkey',
		'webhook',
		'depoPushoverPriority',
		'withdrawPushoverPriority',
		'cooldownPushoverPriority',
		'completedPushoverPriority',
		'protectedPushoverPriority',
		'reversalPushoverPriority',
		'depoAlertSwitchState',
		'withdrawAlertSwitchState',
		'wantReversalAlert',
		'wantProtectedAlert'
	]).then(res => {
		// Boolean switches
		cooldownSwitch.checked = res.cooldownSwitchState;
		completedSwitch.checked = res.completedAlertSwitchState;
		dcNotify.checked = res.dcNotifyState;
		switchNotify.checked = res.switchNotifyState;
		depoAlertSwitch.checked = res.depoAlertSwitchState;
		withdrawalSwitch.checked = res.withdrawAlertSwitchState;
		reversalSwitch.checked = res.wantReversalAlert;
		protectedSwitch.checked = res.wantProtectedAlert;

		// Sensitive fields with placeholder logic
		inputToken.placeholder = res.token ? '*******' : 'token';
		inputUsrkey.placeholder = res.userkey ? '*******' : 'userkey';
		dcWebhook.placeholder = res.webhook ? '*******' : 'Discord Webhook';

		// Priority inputs
		depositPriorityInput.value = res.depoPushoverPriority ?? 0;
		withdrawPriorityInput.value = res.withdrawPushoverPriority ?? 0;
		cooldownPriorityInput.value = res.cooldownPushoverPriority ?? 0;
		completedPriorityInput.value = res.completedPushoverPriority ?? 0;
		protectedPriorityInput.value = res.protectedPushoverPriority ?? 0;
		reversalPriorityInput.value = res.reversalPushoverPriority ?? 0;
	});
}

function callUpdateStorage() {
	chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
		let activeTab = tabs[0];
		chrome.tabs.sendMessage(activeTab.id, { update: true });
	});
}