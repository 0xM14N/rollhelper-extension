let provider;
let btnsRendered = false;
const createButtonCancelDepo = () => {
	const button = document.createElement('button');
	button.classList.add('cancelDepoButton');
	button.style.fontFamily = 'Flama,Roboto,Helvetica Neue,sans-serif;';
	button.style.color = '#000000';
	button.style.background = '#e0cf4c';
	button.style.fontWeight = 'bold';
	button.style.border = 'solid #21252b 3px';
	button.style.borderRadius = '20px';
	const buttonText = document.createTextNode('DELIST');
	button.appendChild(buttonText);

	return button;
};
const createButtonCounter = () => {
	const button = document.createElement('button');
	button.classList.add('counterCoinButton');
	button.style.fontFamily = 'Flama,Roboto,Helvetica Neue,sans-serif;';
	button.style.color = '#000000';
	button.style.background = '#e0cf4c';
	button.style.fontWeight = 'bold';
	button.style.border = 'solid #21252b 3px';
	button.style.borderRadius = '20px';
	button.title = 'TOTAL INVENTORY VALUE';
	const buttonText = document.createTextNode('COINS');
	button.appendChild(buttonText);

	return button;
};

pelogo = chrome.runtime.getURL('/assets/ico/pelogo.png');
const createPeLogoDiv = () => {
	const div = document.createElement('div');
	const img = document.createElement('img');
	const a = document.createElement('a');
	a.href = 'https://old.pricempire.com/r/rollhelper';
	a.target = '_blank';
	img.style.height = '35px';
	img.src = pelogo;
	a.appendChild(img);
	div.appendChild(a);

	return div;
};

cstlogo = chrome.runtime.getURL('/assets/ico/cstlogo.png');
const createCstLogoDiv = () => {
	const div = document.createElement('div');
	const img = document.createElement('img');
	const a = document.createElement('a');
	a.href = 'https://csgotrader.app/prices/';
	a.target = '_blank';
	img.style.height = '35px';
	img.src = cstlogo;
	a.appendChild(img);
	div.appendChild(a);
	return div;
};

const createButtonBox = () => {
	const div = document.createElement('div');
	div.style.display = 'flex';
	div.style.flexDirection = 'column';
	return div;
};

cancelDepoButton = createButtonCancelDepo();
coinCounterButton = createButtonCounter();
peDiv = createPeLogoDiv();
cstDiv = createCstLogoDiv();
boxDiv = createButtonBox();

const intWaitForProviderInt = setInterval(() => {
	const mainHeader = document.querySelector(
		'body > cw-root > cw-header > nav > div:nth-child(2)',
	);

	if (btnsRendered) {
		clearInterval(intWaitForProviderInt);
		mainHeader.appendChild(peDiv);
	}
}, 90);
const intFindPlaceForButtons = setInterval(async function () {
	const mainHeader = document.querySelector(
		'body > cw-root > cw-header > nav > div:nth-child(2)',
	);

	if (mainHeader) {
		clearInterval(intFindPlaceForButtons);
		mainHeader.appendChild(boxDiv);
		boxDiv.appendChild(cancelDepoButton);
		boxDiv.appendChild(coinCounterButton);
		btnsRendered = true;
	}
}, 50);

const intAddEventListeners = setInterval(async function () {
	let cancelBtn = document.getElementsByClassName('cancelDepoButton')[0];
	let coinsBtn = document.getElementsByClassName('counterCoinButton')[0];

	if (cancelBtn && coinsBtn) {
		clearInterval(intAddEventListeners);
		cancelBtn.addEventListener('click', function () {
			cancelNodes = [];
			let res = confirm(
				`Are you sure?\nThis will mass DE-List all of your current deposits`,
			);
			if (res) {
				try {
					var nodes = document.getElementsByClassName('mat-button-wrapper');
					for (i = 0; i < nodes.length; i++) {
						if (nodes[i].innerText === 'CANCEL') {
							cancelNodes.push(nodes[i]);
						}
					}
					for (i = 0; i < cancelNodes.length; i++) {
						cancelNodes[i].click();
					}
				} catch (e) {}
			}
		});
		coinCounterButton.addEventListener('click', function () {
			let coins =
				document.getElementsByClassName('counterCoinButton')[0].textContent;
			navigator.clipboard.writeText(coins);
		});
	}
}, 50);
