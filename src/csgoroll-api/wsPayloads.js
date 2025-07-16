// This does not work anymore via websocket... (replacement in api.js file)
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
		operationName: 'OnUpdateUserTrade',
		query:
		'subscription OnUpdateUserTrade($status: TradeStatus, $userId: ID, $maxAvgPaintWear: UnsignedFloat, $minAvgPaintWear: UnsignedFloat, $activeSince: SequelizeDate, $activeUntil: SequelizeDate, $trackingTypeGroup: TradeTrackingTypeGroup, $categoryIds: [ID!], $stickersAppliedCount: Int, $rarities: [String!]) { updateTrade( status: $status userId: $userId maxAvgPaintWear: $maxAvgPaintWear minAvgPaintWear: $minAvgPaintWear activeSince: $activeSince activeUntil: $activeUntil trackingTypeGroup: $trackingTypeGroup categoryIds: $categoryIds stickersAppliedCount: $stickersAppliedCount rarities: $rarities ) { trade { ...SimpleTrade __typename } __typename } } fragment SimpleTrade on Trade { id depositorLastActiveAt markupPercent totalValue avgPaintWear hasStickers tradeItems { ...SimpleTradeItem __typename } trackingType avgPaintWearRange { min max __typename } canJoinAfter depositor { id steamDisplayName steamId __typename } suspectedTraderCanJoinAfter status steamAppName customValue createdAt updatedAt canJoin expiresAt withdrawer { id steamId steamDisplayName steamLevel avatar steamRegistrationDate name __typename } joinedAt cancelReason withdrawerSteamTradeUrl __typename } fragment SimpleTradeItem on TradeItem { id marketName markupPercent customValue steamExternalAssetId itemVariant { ...SimpleTradeItemVariant __typename } stickers { ...SimpleTradeItemSticker __typename } value patternPercentage __typename } fragment SimpleTradeItemVariant on ItemVariant { brand color name iconUrl rarity depositable itemId id value currency externalId __typename } fragment SimpleTradeItemSticker on TradeItemSticker { imageUrl id name color wear brand __typename }'
	},
};
