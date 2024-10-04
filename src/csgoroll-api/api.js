coinsCounter = 0;

const getCurrentSteamInvData = async () => {
	invFailFetchCount = 0;
	let afterID = '';

	await fetch(domainUrl, {
		method: 'POST',
		headers: {
			Accept: 'application/json, text/plain, */*',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			operationName: 'steamInventoryItems',
			variables: {
				steamAppName: 'CSGO',
				first: 250,
				userId: userID,
				after: `${afterID}`,
			},
			extensions: {
				persistedQuery: {
					version: 1,
					sha256Hash:
						'01ea308cc60ffbd5a4671fe8e762c45ebced3f51c88b89ac245a9f590000c140',
				},
			},
		}),
		credentials: 'include',
	})
		.then(res => res.json())
		.then(res => {
			let tradeListData = res.data.steamInventoryItems.edges;
			let hasNextPage = res.data.steamInventoryItems.pageInfo.hasNextPage;
			for (const itemData of tradeListData) {
				let itemValue = itemData.node.itemVariant.value;
				coinsCounter += itemValue;

				if (itemData.node.tradable === true) {
					let item = {};
					let stickers = [];
					if (itemData.node.steamStickersDescriptions.length > 0) {
						for (const sticker of itemData.node.steamStickersDescriptions) {
							let name = sticker.name;
							stickers.push(name);
						}
					}
					item.steamExternalId = itemData.node.steamExternalAssetId;
					item.marketName = itemData.node.itemVariant.externalId;
					item.assetID = itemData.node.steamItemIdentifiers.assetId;
					item.itemID = itemData.node.itemVariant.itemId;
					item.stickers = stickers;
					if (itemData.node.steamInspectItem?.paintWear) {
						item.float =
							Math.floor(itemData.node.steamInspectItem.paintWear * 1000) /
							1000;
					}
					itemsList.push(item);
				}
			}
			if (hasNextPage) {
				afterID = res.data.steamInventoryItems.pageInfo.endCursor;
				getCurrentSteamInvData();
			} else {
				console.log(
					`%c[ROLLHELPER] -> Successfully loaded tradable items from steam: (${itemsList.length})`,
					depositCSSlog,
				);
				try {
					document.getElementsByClassName('counterCoinButton')[0].innerHTML =
						Math.round(coinsCounter);
				} catch (err) {
					// ...
				}
			}
		})
		.catch(error => {
			console.log(
				`%c[ROLLHELPER - ERROR] -> Failed to load the steam inventory data - trying again in 3 seconds`,
				errorCSSlog,
			);
			console.log(error);
			invFailFetchCount += 1;
			setTimeout(() => {
				if (invFailFetchCount <= 3) {
					getCurrentSteamInvData();
				} else {
					console.log(
						`%c[ROLLHELPER - ERROR] -> Max amount of tries reached - refresh the page to load inventory`,
						errorCSSlog,
					);
				}
			}, 3000);
		});
};

async function getUserID() {
	let getUserIDcounter = 0;

	await fetch(domainUrl, {
		method: 'POST',
		headers: {
			Accept: 'application/json, text/plain, */*',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			operationName: 'CurrentUser',
			variables: {},
			query:
				'query CurrentUser {\n  currentUser {\n    ...User\n    __typename\n' +
				'  }\n}\n\nfragment User on User {\n  id\n  name\n  email\n  verified\n  cu' +
				'rrency\n  createdAt\n  acceptTos\n  avatar\n  steamId\n  mutedUntil\n  role' +
				's\n  userProgress {\n    id\n    xp\n    requiredXp\n    nextRequiredXp\n    le' +
				'vel\n    __typename\n  }\n  unlockedChat\n  lastDepositAt\n  stickyReferee\n  stea' +
				'mApiKey\n  steamTradeUrl\n  verificationStatus\n  totalDeposit\n  dailyWithdrawLimit' +
				'\n  preferences {\n    ...UserPreferences\n    __typename\n  }\n  referralPromoCode {\n   ' +
				' id\n    code\n    __typename\n  }\n  team {\n    id\n    name\n    __typename\n  }\n  tick' +
				'ets {\n    total\n    __typename\n  }\n  wallets {\n    ...Wallet\n    __typename\n  }\n  marke' +
				't {\n    id\n    slug\n    name\n    __typename\n  }\n  trader\n  suspectedTrader\n  microphoneEna' +
				'bled\n  __typename\n}\n\nfragment UserPreferences on UserPreferences {\n  id\n  name\n  lastName\n ' +
				' address1\n  address2\n  postcode\n  region\n  city\n  country {\n    code\n    name\n    __typenam' +
				'e\n  }\n  birthDate\n  gender\n  phone\n  __typename\n}\n\nfragment Wallet on Wallet {\n  id\n  name\n' +
				'  amount\n  currency\n  __typename\n}\n',
		}),
		credentials: 'include',
	})
		.then(res => res.json())
		.then(res => {
			userID = res.data.currentUser.id;
			balance = res.data.currentUser.wallets[0].amount;

			coinsCounter += balance;
			let btn = document.getElementsByClassName('counterCoinButton')[0];
			if (btn) btn.innerHTML = Math.round(coinsCounter);
		});
}
