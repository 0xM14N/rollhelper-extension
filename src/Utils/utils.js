// CONSOLE LOGGING CSS
noticeCSSlog =
	'color:#00FFFFFF;background-color:black;font-weight: bold; font-size:13px';
depositCSSlog =
	'color:yellow;background-color:black;font-weight: bold; font-size:13px';
errorCSSlog =
	'color:red;background-color:black;font-weight: bold; font-size:13px';
withdrawAcceptedCSSlog =
	'color:#7CFC00FF;background-color:black;font-weight: bold; font-size:13px';
pricempireCSSlog =
	'color:#C27E00FF;background-color:black;font-weight: bold; font-size:13px';
tradeCompletedCSSlog =
	'color:#FFFF;background-color:black;font-weight: bold; font-size:13px';
steamOfferCSSlog =
	'color:#0bba9a;background-color:black;font-weight: bold; font-size:13px';
bannerCSSlog =
	'color:red;background-color:black;font-weight: bold; font-size:55px';

const sendSteamTradeOffer = (assetID, tradeLink, offerMessage) => {
	chrome.runtime.sendMessage(
		{
			type: 'sendSteamOffer',
			assetID: assetID,
			tradeLink: tradeLink,
			offerMsg: offerMessage,
		},
		response => {},
	);
};

let DateFormater = date =>
	'[' +
	new Date().toLocaleString('en-US', {
		hour12: false,
		hour: 'numeric',
		minute: 'numeric',
	}) +
	']';

const isDoppler = marketName => {
	return (marketName.includes('Doppler') ||
		marketName.includes('Emerald') ||
		marketName.includes('Ruby') ||
		marketName.includes('Black Pearl') ||
		marketName.includes('Sapphire')) &&
		isKnife(marketName)
		? true
		: false;
};

kniveTypes = ['knife', 'karambit', 'bayonet', 'daggers'];
const isKnife = marketName => {
	marketName = marketName.toLowerCase();
	if (kniveTypes.some(knifeType => marketName.includes(knifeType))) {
		return true;
	}
	return false;
};

const refactorDopplerNameForPE = marketName => {
	const phaseMatch = /Phase (\d+)/;
	const gemMatch = /(Ruby|Sapphire|Black Pearl|Emerald)/;
	if (marketName.match(phaseMatch)) {
		let match = marketName.match(phaseMatch)[0];
		let refactored = marketName.replace(match + ' ', '') + ` - ${match}`;
		return refactored;
	} else {
		if (marketName.match(gemMatch)) {
			let match = marketName.match(gemMatch)[0];
			if (match === 'Emerald') {
				let refactored =
					marketName.replace(match, 'Gamma Doppler') + ` - ${match}`;
				return refactored;
			} else {
				let refactored = marketName.replace(match, 'Doppler') + ` - ${match}`;
				return refactored;
			}
		}
	}
};

const refactorDopplerNameForCSGOTR = marketName => {
	const phaseMatch = /Phase (\d+)/;
	const gemMatch = /(Ruby|Sapphire|Black Pearl|Emerald)/;

	if (marketName.match(phaseMatch)) {
		let phase = marketName.match(phaseMatch)[0];
		let refactoredName = marketName.replace(phase + ' ', '');
		return [refactoredName, phase];
	} else {
		if (marketName.match(gemMatch)) {
			let match = marketName.match(gemMatch)[0];
			if (match === 'Emerald') {
				let refactored = marketName.replace(match, 'Gamma Doppler');
				return [refactored, match];
			} else {
				let refactored = marketName.replace(match, 'Doppler');
				return [refactored, match];
			}
		}
	}
};

const evalMaxMarkup = (itemBasePrice, addedStickerValue) => {
	let maxItemValue = itemBasePrice + addedStickerValue;
	let maxMarkupPercent = ((maxItemValue - itemBasePrice) / itemBasePrice) * 100;
	if (maxMarkupPercent <= 12) return 12;
	return (maxMarkupPercent + 12).toFixed(2);
};

function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = (Math.random() * 16) | 0,
			v = c == 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

const createApiUrl = tabUrl => {
	if (tabUrl.includes('csgorolltr.com')) {
		return 'https://api.csgorolltr.com/graphql';
	}
	if (tabUrl.includes('csgoroll.com')) {
		return 'https://api.csgoroll.com/graphql';
	}
	if (tabUrl.includes('csgoroll.gg')) {
		return 'https://api.csgoroll.gg/graphql';
	}
};

const buffProfitEval = (marketName, rollprice, event = 'other') => {
	let rate;
	if (event === 'deposit') {
		rate = 0.66; // always use 0.66 rate for deposit logs
	} else {
		// Withdraw logs using rate.json file
		if (marketName.includes('Doppler')) {
			rate = 0.65;
		} else {
			rate = rates[marketName];
			if (rate === undefined) {
				rate = 0.66; // using default rate in case rate is not found
			} else {
				rate = rates[marketName].rate; // rate found in rate.json
			}
		}
	}
	// PRICING PROVIDERS
	switch (provider) {
		// DEFAULT PROVIDER PRICEMPIRE
		case 'pricempire':
			if (isDoppler(marketName))
				marketName = refactorDopplerNameForPE(marketName);

			price_obj = prices[marketName];
			if (price_obj) {
				try {
					if (price_obj.buff.isInflated) {
						console.log(
							`%c[PRICEMPIRE WARNING] -> INFLATED ITEM`,
							pricempireCSSlog,
						);
					}
					let buff_usd = price_obj.buff.price / 100;
					let coins_usd = rollprice * rate;
                    let liquidity = price_obj.liquidity || 0;

					let profit = (
						100 + parseFloat(((coins_usd - buff_usd) / buff_usd) * 100)
					).toFixed(2);
					return [buff_usd, profit, rate, Math.round(liquidity)];
				} catch (err) {
					console.log(`%cPRICECHECK ERROR: ${marketName}`, errorCSSlog);
				}
			}
			return null;
	}
};

// PRICEMPIRE PRICE DATA LOAD
async function loadPriceDataPricempire() {
	chrome.runtime.sendMessage(
		{ type: 'pricempire', key: peApiKey },
		async response => {
			if (response.error) {
				console.log(
					`%c[PRICEMPIRE - ERROR] -> ${response.error}`,
					pricempireCSSlog,
				);
			} else {
				provider = 'pricempire';
				prices = response;
				console.log(
					`%c[PRICEMPIRE] -> Successfully loaded current price data`,
					pricempireCSSlog,
				);
				return prices;
			}
		},
	);
}
