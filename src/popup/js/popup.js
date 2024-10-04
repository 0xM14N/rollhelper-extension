let saveBtn = document.getElementById('saveSettings');
let switchDepo = document.getElementById('depoSwitch');
let sendOfferSwitch = document.getElementById('sendOfferSwitch');
let steamMsgInput = document.getElementById('steamOfferMessageInput');

document.addEventListener('DOMContentLoaded', function () {
	restoreOptions();
});

saveBtn.addEventListener('click', async function () {
	let offerMessageValue = steamMsgInput.value;

	if (offerMessageValue != '') {
		chrome.storage.sync.set(
			{
				steamOfferMessage: offerMessageValue,
			},
			() => callUpdateStorage(),
		);
	} else {
		callUpdateStorage();
	}

	window.close();
});

let UIconfigSTATE;

sendOfferSwitch.addEventListener('change', function () {
	if (this.checked) {
		chrome.storage.sync.set(
			{
				wantSendOffersState: true,
				wantSendOffers: true,
			},
			() => callUpdateStorage(),
		);
	} else {
		chrome.storage.sync.set(
			{
				wantSendOffersState: false,
				wantSendOffers: false,
			},
			() => callUpdateStorage(),
		);
	}
});

switchDepo.addEventListener('change', function () {
	if (this.checked) {
		chrome.storage.sync.set(
			{
				switchDepoState: true,
			},
			() => callUpdateStorage(),
		);
	} else {
		chrome.storage.sync.set({
			switchDepoState: false,
		});
	}
});

function restoreOptions() {
	chrome.storage.sync.get(['switchDepoState']).then(res => {
		switchDepo.checked = res.switchDepoState;
	});

	chrome.storage.sync.get(['wantSendOffersState']).then(res => {
		sendOfferSwitch.checked = res.wantSendOffersState;
	});

	chrome.storage.sync.get(['steamOfferMessage']).then(res => {
		if (!res.steamOfferMessage) {
			steamMsgInput.placeholder = 'Steam Offer Message';
		}
		if (res.steamOfferMessage) {
			steamMsgInput.placeholder = res.steamOfferMessage;
		}
	});
}

function callUpdateStorage() {
	chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
		let activeTab = tabs[0];
		chrome.tabs.sendMessage(activeTab.id, { update: true });
	});
}
