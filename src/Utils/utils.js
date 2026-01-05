noticeCSSlog = 'color:#00FFFFFF;background-color:black;font-weight: bold; font-size:13px';
depositCSSlog = 'color:yellow;background-color:black;font-weight: bold; font-size:13px';
errorCSSlog = 'color:red;background-color:black;font-weight: bold; font-size:13px';
withdrawAcceptedCSSlog = 'color:#7CFC00FF;background-color:black;font-weight: bold; font-size:13px';
cspApiCSSlog = 'color:#C27E00FF;background-color:black;font-weight: bold; font-size:13px';
tradeCompletedCSSlog = 'color:#FFFF;background-color:black;font-weight: bold; font-size:13px';
steamOfferCSSlog = 'color:#0bba9a;background-color:black;font-weight: bold; font-size:13px';
bannerCSSlog = 'color:red;background-color:black;font-weight: bold; font-size:55px';
cspCSSlog = 'color:#7CFC00FF;background:black;font-weight:bold;font-size:10px';

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
	(isKnife(marketName) || marketName.includes('Glock'))
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
		return 'https://router.csgorolltr.com/graphql';
	}
	if (tabUrl.includes('csgoroll.com')) {
		return 'https://router.csgoroll.com/graphql';
	}
	if (tabUrl.includes('csgoroll.gg')) {
		return 'https://router.csgoroll.gg/graphql';
	}
};

const getPriceDataForLogs = (marketName, rollprice, event = 'other') => {
	let itemInfo = {}
	let rate;

	const cspurl = getCSPUrl(marketName)

	itemInfo.buffDelta = "-";
	itemInfo.csfDelta = "-";
	itemInfo.uuDelta = "-";
	itemInfo.liquidity = "-";
	itemInfo.isInflated = "-";
	itemInfo.buff_usd = "-";
	itemInfo.csp_url = cspurl;


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
	itemInfo.rollUSD = rollprice*rate;

	if (isDoppler(marketName)) marketName = refactorDopplerNameForPE(marketName);

	try{
		price_obj = prices[marketName];
		if (price_obj === undefined) {
			console.log(`[PRICECHECK ERROR]: ${itemName}`);
			itemInfo.error = true;
			return null;
		}
		let buff_usd;
		let uu_usd;
		let csf_usd;
		let is_inflated;
		let liq;

		liq = price_obj?.liquidity != null ? Number(price_obj.liquidity.toFixed(0)) : 0;
		buff_usd = price_obj?.price_buff != null ? price_obj.price_buff / 100 : null;
		uu_usd = price_obj?.price_uu/100 || null;
		csf_usd = price_obj?.price_csfloat != null ? price_obj.price_csfloat / 100 : null;
		is_inflated = price_obj?.is_inflated ?? true;

		// buff163
		let realBuffVal = buff_usd / rate;
		let buffVal = Math.floor(realBuffVal * 100) / 100;
		const buffDelta = calcDelta(rollprice, buff_usd, rate);

		// csfloat
		let realCSFVal = csf_usd / rate;
		let csfVal = Math.floor(realCSFVal * 100) / 100;
		const csfDelta  = calcDelta(rollprice, csf_usd, rate);

		// UU
		let realUUFVal = uu_usd / rate;
		let uuVal = Math.floor(realUUFVal * 100) / 100;
		const uuDelta  = calcDelta(rollprice, uu_usd, rate);

		itemInfo.buffDelta = buffDelta;
		itemInfo.csfDelta = csfDelta;
		itemInfo.uuDelta = uuDelta;
		itemInfo.liquidity = liq;
		itemInfo.isInflated = is_inflated;
		itemInfo.rollUSD = Number((rollprice*rate).toFixed(2));
		itemInfo.buff_usd = buff_usd;
		itemInfo.csp_url = cspurl;
		itemInfo.rate = rate;

		return itemInfo;
	} catch (e) {
		console.log(`%cPRICECHECK ERROR: ${marketName}`, errorCSSlog);
	}

	return itemInfo;
}


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
		// DEFAULT PROVIDER CSP
		case 'cspricebase':
			if (isDoppler(marketName))
				marketName = refactorDopplerNameForPE(marketName);

			price_obj = prices[marketName];
			if (price_obj) {
				try {
					if (price_obj.buff.isInflated) {
						console.log(
							`%c[WARNING] -> INFLATED ITEM`,
							cspApiCSSlog,
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

async function loadCSP() {
	chrome.runtime.sendMessage(
		{ type: 'cspricebase', key: cspApiKey },
		async response => {
			if (response.error) {
				console.log(
					`%c[CS:PRICEBASE - ERROR] -> ${response.error}`,
					cspApiCSSlog,
				);
			} else {
				provider = 'cspricebase';
				prices = response.data;

				console.log(
					`%c[CS:PRICEBASE] -> Successfully loaded current price data`,
					cspApiCSSlog,
				);
				return prices;
			}
		},
	);
}

function transformGemDopplerForCsp(marketName) {
	const gems = ['Ruby', 'Sapphire', 'Emerald', 'Black Pearl'];

	const gem = gems.find(g => marketName.includes(g));
	if (!gem) return marketName;

	return marketName
		.replace(` - ${gem}`, '')
		.replace(/Gamma Doppler|Doppler/, gem);
}

function getCSPUrl (marketName) {
	let input = transformGemDopplerForCsp(marketName) // doppler gem check
	return `https://cspricebase.com/database?marketName=${encodeURIComponent(input)}`
}

function formatExterior(exterior) {
	if (!exterior) return "";
	exterior = exterior.toLowerCase().trim();
	return exterior[0].toUpperCase() + exterior.slice(1);
}