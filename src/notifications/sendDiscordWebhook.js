const sendWebHookDiscord = (
	urlDiscordWebhook = Webhook,
	webhookType,
	tradeInfo = {},
) => {
	const url = urlDiscordWebhook;
	const templateWebhook = {
		areYouReady: {
			username: `ROLLHELPER`,
			avatar_url:
				'https://images.g2a.com/360x600/1x1x1/csgoroll-gift-card-5-coins-key-global-i10000337548004/cbf80f13366c442d940a792f',
			content: '',
			tts: false,
			embeds: [
				{
					type: 'rich',
					title: `CSGOROLL DEPOSIT`,
					description: `Your skin has just been sold!`,
					color: 0x00ffff,
					fields: [
						{
							name: `SKIN`,
							value: `${tradeInfo.marketname} ${tradeInfo.float}`,
							inline: true,
						},
						{
							name: `PRICE`,
							value: `${tradeInfo.value} coins`,
							inline: true,
						},
						{
							name: `MARKUP`,
							value: `${tradeInfo.markup}% [${tradeInfo.maxMarkup}%]`,
							inline: true,
						},
						{
							name: `%BUFF163`,
							value: `${tradeInfo.buff_percent}%`,
							inline: true,
						},
						{
							name: `BUFF163`,
							value: `${tradeInfo.buff163}$`,
							inline: true,
						},
						{
							name: `ROLL-USD`,
							value: `${tradeInfo.coins_usd}$`,
							inline: true,
						},
					],
					author: {
						name: `ROLLHELPER`,
						url: `https://cspricebase.com/`,
					},
					footer: {
						text: `DONT SEE PRICING / COMPARASION?\nGet your subscription on CS:Pricebase via link bellow! (Premium / Free Trial)\nhttps://www.cspricebase.com/`,
					},
					thumbnail: {
						url: tradeInfo.iconUrl,
					},
				},
			],
		},

		IncommingTrade: {
			username: `ROLLHELPER`,
			avatar_url:
				'https://images.g2a.com/360x600/1x1x1/csgoroll-gift-card-5-coins-key-global-i10000337548004/cbf80f13366c442d940a792f',
			content: '',
			tts: false,
			embeds: [
				{
					type: 'rich',
					title: `CSGOROLL WITHDRAW`,
					description: `You just bought skin!`,
					color: 0x1eff00,
					fields: [
						{
							name: `SKIN`,
							value: `${tradeInfo.marketname} ${tradeInfo.float}`,
							inline: true,
						},
						{
							name: `PRICE`,
							value: `${tradeInfo.value} coins`,
							inline: true,
						},
						{
							name: `MARKUP`,
							value: `${tradeInfo.markup}% [${tradeInfo.maxMarkup}%]`,
							inline: true,
						},
						{
							name: `%BUFF163`,
							value: `${tradeInfo.buff_percent}%`,
							inline: true,
						},
						{
							name: `BUFF163`,
							value: `${tradeInfo.buff163}$`,
							inline: true,
						},
						{
							name: `ROLL-USD`,
							value: `${tradeInfo.coins_usd}$`,
							inline: true,
						},
					],
					author: {
						name: `ROLLHELPER`,
						url: `https://cspricebase.com/`,
					},
					footer: {
						text: `DONT SEE PRICING / COMPARASION?\nGet your subscription on CS:Pricebase via link bellow! (Premium / Free Trial)\nhttps://www.cspricebase.com/`,
					},
					thumbnail: {
						url: tradeInfo.iconUrl,
					},
				},
			],
		},
		TradeCompleted: {
			username: `ROLLHELPER`,
			avatar_url:
				'https://images.g2a.com/360x600/1x1x1/csgoroll-gift-card-5-coins-key-global-i10000337548004/cbf80f13366c442d940a792f',
			content: '',
			tts: false,
			embeds: [
				{
					type: 'rich',
					title: `CSGOROLL COMPLETED`,
					description: `The trade has been completed!`,
					color: 0xfff8f8,
					fields: [
						{
							name: `SKIN`,
							value: `${tradeInfo.marketname} ${tradeInfo.float}`,
							inline: true,
						},
						{
							name: `PRICE`,
							value: `${tradeInfo.value} coins`,
							inline: true,
						},
						{
							name: `MARKUP`,
							value: `${tradeInfo.markup}% [${tradeInfo.maxMarkup}%]`,
							inline: true,
						},
						{
							name: `%BUFF163`,
							value: `${tradeInfo.buff_percent}%`,
							inline: true,
						},
						{
							name: `BUFF163`,
							value: `${tradeInfo.buff163}$`,
							inline: true,
						},
						{
							name: `ROLL-USD`,
							value: `${tradeInfo.coins_usd}$`,
							inline: true,
						},
					],
					author: {
						name: `ROLLHELPER`,
						url: `https://cspricebase.com/`,
					},
					footer: {
						text: `DONT SEE PRICING / COMPARASION?\nGet your subscription on CS:Pricebase via link bellow! (Premium / Free Trial)\nhttps://www.cspricebase.com/`,
					},
					thumbnail: {
						url: tradeInfo.iconUrl,
					},
				},
			],
		},
		TradeCooldown: {
			username: `ROLLHELPER`,
			avatar_url:
				'https://images.g2a.com/360x600/1x1x1/csgoroll-gift-card-5-coins-key-global-i10000337548004/cbf80f13366c442d940a792f',
			content: '',
			tts: false,
			embeds: [
				{
					type: 'rich',
					title: `CSGOROLL COOLDOWN`,
					description: `Your trade has expired, cancel the steam offer!`,
					color: 0xf30909,
					fields: [
						{
							name: `SKIN`,
							value: `${tradeInfo.marketname} ${tradeInfo.float}`,
							inline: true,
						},
						{
							name: `PRICE`,
							value: `${tradeInfo.value} coins`,
							inline: true,
						},
						{
							name: `MARKUP`,
							value: `${tradeInfo.markup}%`,
							inline: true,
						},
					],
					author: {
						name: `ROLLHELPER`,
						url: `https://cspricebase.com/`,
					},
					footer: {
						text: `DONT SEE PRICING / COMPARASION?\nGet your subscription on CS:Pricebase via link bellow! (Premium / Free Trial)\nhttps://www.cspricebase.com/`,
					},
					thumbnail: {
						url: tradeInfo.iconUrl,
					},
				},
			],
		},
	};

	const params = templateWebhook[webhookType];
	fetch(url, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify(params),
	})
		.then(res => {
			if (res.status !== 204){
				console.log(`[DISCORD-ERROR]: res.status: ${res.status} | ${res.statusText}`);
			}
		})
		.catch(err => console.log(`[DISCORD-FETCH-ERROR]: ${err.message}`, err))
};
