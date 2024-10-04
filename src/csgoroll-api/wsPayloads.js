const acceptTrade = tradeid => {
	socket.send(
		JSON.stringify({
			id: uuidv4(),
			type: 'subscribe',
			payload: {
				variables: {
					input: {
						tradeId: tradeid,
					},
				},
				extensions: {},
				operationName: 'ProcessTrade',
				query:
					'mutation ProcessTrade($input: ProcessTradeInput!) ' +
					'{\n  processTrade(input: $input) {\n    trade {\n     ' +
					' id\n      status\n      totalValue\n      updatedAt\n    ' +
					'  expiresAt\n      withdrawerSteamTradeUrl\n      __typename\n    }\n    __typename\n  }\n}\n',
			},
		}),
	);
};

let updateTradePayload = {
	id: uuidv4(),
	type: 'subscribe',
	payload: {
		variables: {
			userId: userID,
		},
		extensions: {},
		operationName: 'OnUpdateTrade',
		query:
			'subscription OnUpdateTrade($status: TradeStatus, $userId: ID) {\n  updateTrade(status: $status, userId: $userId) {\n    trade {\n      ...Trade\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment Trade on Trade {\n   id\n  status\n  steamAppName\n  cancelReason\n  canJoinAfter\n  markupPercent\n  createdAt\n  depositor {\n    id\n    steamId\n    avatar\n    displayName\n    steamDisplayName\n    online\n    __typename\n  }\n  depositorLastActiveAt\n  expiresAt\n  withdrawerSteamTradeUrl\n  customValue\n  withdrawer {\n    id\n    steamId\n    avatar\n    displayName\n    steamDisplayName\n    __typename\n  }\n  totalValue\n  updatedAt\n  tradeItems {\n    id\n    marketName\n    value\n    customValue\n    itemVariant {\n      ...ItemVariant\n      __typename\n    }\n    markupPercent\n    stickers {\n      ...SimpleSticker\n      __typename\n    }\n    steamExternalAssetId\n    __typename\n  }\n  trackingType\n  suspectedTraderCanJoinAfter\n  joinedAt\n  avgPaintWear\n  hasStickers\n  __typename\n}\n\nfragment ItemVariant on ItemVariant {\n  id\n  itemId\n  name\n  brand\n  iconUrl\n  value\n  displayValue\n  externalId\n  color\n  rarity\n  depositable\n  __typename\n}\n\nfragment SimpleSticker on TradeItemSticker {\n  value\n  imageUrl\n  brand\n  name\n  color\n  wear\n  __typename\n}\n',
	},
};
