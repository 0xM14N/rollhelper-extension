const look4rates = setInterval(() => {
	if (
		rates &&
		prices &&
		Object.keys(rates).length > 0 &&
		Object.keys(prices).length > 0
	) {
		clearInterval(look4rates);
		startMutationObserver();
	}
}, 150);

async function startMutationObserver() {
	const observer = new MutationObserver(function (mutationsList, observer) {
		for (let mutation of mutationsList) {
			if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
				for (let node of mutation.addedNodes) {
					if (
						node instanceof HTMLElement &&
						node.localName === 'cw-csgo-market-item-card' &&
						!node.firstChild.classList.contains('horizontal')
					) {
						setBuffValue(node);
					}
				}
			}
		}
	});
	observer.observe(document.body, {
		attributes: true,
		childList: true,
		subtree: true,
	});
}

function drawRealMarkup(calcRes, calc) {
	let span = document.createElement('span');
	span.style.fontWeight = '500';
	span.style.color = 'white';

	let r = '🔴 +' + calc + '%';
	let c = '🔵 ' + calc + '%';
	let o = '🟢 ' + calc + '%';

	if (calcRes === 'Overpriced') span.innerText = r;
	if (calcRes === 'Underpriced') span.innerText = c;
	if (calcRes === 'Goodpriced') span.innerText = o;

	divInner.appendChild(span);
	return divInner;
}

function setBuffValue(item) {
	var itemInfo = {};
	let itemName = '';
	let isSticker = false;
	let isStickered = false;

	//  WEAPON TYPE ===============================================================
	let stickeredItem = item.querySelector(
		'div:nth-child(1) > div:nth-child(1) > div:nth-child(5) > span:nth-child(2)',
	);
	let normalItem = item.querySelector(
		'div:nth-child(1) > div:nth-child(1) > div:nth-child(4) > span:nth-child(2)',
	);

	if (
		item.querySelector(
			'div:nth-child(1) > div:nth-child(1) > div:nth-child(4) > span:nth-child(2)',
		)
	) {
		itemInfo.skinWeapon = item
			.querySelector(
				'div:nth-child(1) > div:nth-child(1) > div:nth-child(4) > span:nth-child(2)',
			)
			.innerHTML.trim();
		// is non-stickered
		if (itemInfo.skinWeapon === 'Sticker') {
			isSticker = true;
			itemName += 'Sticker | ';
		} else {
			itemName += itemInfo.skinWeapon;
		}
	} else {
		// is stickered
		itemInfo.skinWeapon = item
			.querySelector(
				'div:nth-child(1) > div:nth-child(1) > div:nth-child(5) > span:nth-child(2)',
			)
			.innerHTML.trim();
		itemName += itemInfo.skinWeapon;
		isStickered = true;
	}

	// SKIN NAME  ===============================================================
	if (item.querySelector('div:nth-child(1) > div:nth-child(1) > label')) {
		if (isSticker) {
			let skin = item
				.querySelector('div:nth-child(1) > div:nth-child(1) > label')
				.innerHTML.trim();
			itemName += skin;
		} else {
			let skin = item
				.querySelector('div:nth-child(1) > div:nth-child(1) > label')
				.innerHTML.trim();
			let nameArr = skin.split(' ');
			let f = nameArr[0];
			let s = nameArr[1];

			// if doppler has a phase
			if (f == 'Doppler') {
				itemInfo.skinName = 'Doppler';
				itemName += ' | ' + 'Doppler';
				var phase = s + ' ' + nameArr[2];
			}

			// if doppler is a gem
			else if (nameArr.length === 1 && (f == 'Ruby' || f == 'Sapphire')) {
				itemInfo.skinName = f;
				itemName += ' | ' + 'Doppler';
				var phase = f;
			}

			// if doppler is a Black Pearl
			else if (f == 'Black' && s == 'Pearl') {
				itemInfo.skinName = 'Black Pearl';
				itemName += ' | ' + 'Doppler';
				var phase = 'Black Pearl';
			}

			// if doppler is a gamma doppler
			else if (f == 'Gamma' && s == 'Doppler') {
				itemInfo.skinName = f + ' ' + s;
				itemName += ' | ' + 'Gamma Doppler';
				var phase = nameArr[2] + ' ' + nameArr[3];
			}

			// if gamma doppler is a gem -> emerald
			else if (nameArr.length === 1 && f == 'Emerald' && isKnife(itemName)) {
				itemInfo.skinName = f;
				itemName += ' | ' + 'Gamma Doppler';
				var phase = 'Emerald';
			} else if (
				itemInfo.skinWeapon.includes('Case') ||
				itemInfo.skinWeapon.includes('Pin')
			) {
				// continue
			} else if (!skin) {
				// continue
			} else {
				itemInfo.skinName = skin;
				itemName += ' | ' + skin;
			}
		}
	}

	// SKIN EXTERIOR   ===============================================================
	let exterior;

	// depo page float value selector:
	let ext = item.querySelector(
		'div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > span:nth-child(2)',
	);
	if (ext) {
		// we are on depo page
		ext = ext.innerHTML.trim().split(' ')[0];

		if (isSticker) {
			itemInfo.skinExterior = ' (' + ext + ')';
			let nameArr = itemName.split(' ');
			let f = 0;
			for (let i = 0; i < nameArr.length; i++) {
				if (nameArr[i] === '|') {
					f++;
					if (f === 2) {
						nameArr[i - 1] += itemInfo.skinExterior;
						break;
					}
				}
			}
			itemName = nameArr.join(' ');
		} else {
			if (ext === 'FN') {
				itemInfo.skinExterior = exterior;
				itemName += ' (Factory New)';
			}
			if (ext === 'MW') {
				itemInfo.skinExterior = exterior;
				itemName += ' (Minimal Wear)';
			}
			if (ext === 'FT') {
				itemInfo.skinExterior = exterior;
				itemName += ' (Field-Tested)';
			}
			if (ext === 'WW') {
				itemInfo.skinExterior = exterior;
				itemName += ' (Well-Worn)';
			}
			if (ext === 'BS') {
				itemInfo.skinExterior = exterior;
				itemName += ' (Battle-Scarred)';
			}
			if (ext === '\x3C!---->-') {
				itemInfo.skinExterior = '';
				itemName += '';
			}
		}
	} else {
		//p2p page float value selector:
		if (isSticker) {
			//  HOLO - bg-legendary
			//  FOIL - bg-exotic
			//  NORMAL - bg-high
			//  GOLD - bg-extraordinary
			//  HOLO - bg-remarkable
			//  GLITTER - has same class as holo = no luck detecting = shows up holo pricing for now
			let ext;
			let ext_check_classList = item.querySelector(
				'div > div > div:nth-child(4) > span',
			).classList;
			switch (true) {
				case ext_check_classList.contains('bg-legendary'):
					ext = 'Holo';
					break;
				case ext_check_classList.contains('bg-exotic'):
					ext = 'Foil';
					break;
				case ext_check_classList.contains('bg-remarkable'):
					ext = 'Holo';
					break;
				case ext_check_classList.contains('bg-extraordinary'):
					ext = 'Gold';
					break;
				default:
					ext = '';
			}
			if (ext != '') {
				itemInfo.skinExterior = ' (' + ext + ')';
				let nameArr = itemName.split(' ');
				let f = 0;
				for (let i = 0; i < nameArr.length; i++) {
					if (nameArr[i] === '|') {
						f++;
						if (f === 2) {
							nameArr[i - 1] += itemInfo.skinExterior;
							break;
						}
					}
				}
				itemName = nameArr.join(' ');
			}
		} else {
			let extElement = item.querySelector('cw-item-float-indicator > span');
			let ext = extElement ? extElement.textContent.trim().substring(0, 2) : '';

			if (ext === 'FN') {
				itemInfo.skinExterior = exterior;
				itemName += ' (Factory New)';
			}
			if (ext === 'MW') {
				itemInfo.skinExterior = exterior;
				itemName += ' (Minimal Wear)';
			}
			if (ext === 'FT') {
				itemInfo.skinExterior = exterior;
				itemName += ' (Field-Tested)';
			}
			if (ext === 'WW') {
				itemInfo.skinExterior = exterior;
				itemName += ' (Well-Worn)';
			}
			if (ext === 'BS') {
				itemInfo.skinExterior = exterior;
				itemName += ' (Battle-Scarred)';
			}
			if (ext === '\x3C!---->-') {
				itemInfo.skinExterior = '';
				itemName += '';
			}
		}
	}

	let rollPrice;
	if (!isStickered) {
		rollPrice =
			Math.floor(
				item
					.querySelector(
						'div:nth-child(1) > div:nth-child(1) > ' +
							'div:nth-child(6) > cw-pretty-balance > span',
					)
					.innerText.replace(',', '') * 100,
			) / 100;
	} else {
		rollPrice =
			Math.floor(
				item
					.querySelector(
						'div:nth-child(1) > div:nth-child(1) > ' +
							'div:nth-child(7) > cw-pretty-balance > span',
					)
					.innerText.replace(',', '') * 100,
			) / 100;
	}

	let rate;
	if (
		itemName.includes('Doppler') |
		itemName.includes('Sapphire') |
		itemName.includes('Ruby')
	) {
		rate = 0.65;
	} else {
		rate = rates[itemName];
		if (rate === undefined) {
			rate = 0.66;
		} else {
			rate = rates[itemName].rate;
		}
	}

	switch (provider) {
		case 'pricempire':
			if (phase !== undefined) itemName = itemName + ' - ' + phase;
			price_obj = prices[itemName];
			if (price_obj === undefined) return;
			if (price_obj?.buff?.price) {
				buff_usd = price_obj.buff.price / 100;
				liquidity = price_obj.liquidity;
				isInflated = price_obj.buff.isInflated;
			}
			break;
	}

	let tbuffVal = buff_usd / rate;
	let buffVal = Math.floor(tbuffVal * 100) / 100;
	let calc = ((rollPrice / buffVal) * 100 - 100).toFixed(1);

	let parent_el = item.querySelector('div > div:nth-child(7)');
	if (!parent_el) {
		parent_el = item.querySelector('div > div:nth-child(6)');
	}

	divInner = document.createElement('div');
	divInner.style.display = 'flex';
	divInner.style.flexDirection = 'column';
	divInner.style.justifyContent = 'center';
	divInner.style.alignItems = 'center';

	let parentElSpans = parent_el.getElementsByTagName('span');
	let inflated_parent = item.querySelector(
		'div > div > div > span:nth-of-type(2)',
	);
	let liquidity_parent;

	if (isInflated) {
		drawIsInflated(inflated_parent);
		inflated_parent.firstElementChild.remove();
	}

	if (!isStickered) {
		liquidity_parent = item.querySelector('div > div > div:nth-of-type(6)');
	} else {
		liquidity_parent = item.querySelector('div > div > div:nth-of-type(7)');
	}

	if (parentElSpans.length > 1) {
		let delSpan = parentElSpans[1];
		delSpan.style.alignSelf = 'flex-end';
		delSpan.remove();
		divInner.appendChild(delSpan);
	}

	let res = evalDisplay(rollPrice, buffVal);
	parent_el.appendChild(divInner);
	parent_el.appendChild(drawRealMarkup(res, calc));
	drawLiquidityData(liquidity, liquidity_parent);
}

function drawLiquidityData(liq, parent) {
	let span = document.createElement('span');
	span.style.fontWeight = '500';
	span.style.color = '#2fa1b0';
	span.innerText = `LIQ: ${liq.toFixed(0)}%`;
	parent.appendChild(span);
}

function drawIsInflated(parent) {
	let span = document.createElement('span');
	let div = document.createElement('div');
	span.style.fontWeight = '500';
	span.style.color = '#8d0000';

	span.innerText = `INFLATED`;
	div.appendChild(span);
	parent.appendChild(div);
}

function evalDisplay(rollPrice, buffPrice) {
	let v = rollPrice / buffPrice;
	let val = (v * 100) / 100;
	if (val > 1.03) return 'Overpriced';
	if (val <= 1.03 && val >= 0.97) return 'Goodpriced';
	if (val < 0.97) return 'Underpriced';
}
