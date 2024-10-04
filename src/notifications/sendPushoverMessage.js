const sendPushoverNotification = (scrapedData = {}) => {
	const url = 'https://api.pushover.net/1/messages.json';
	const formData = new FormData();
	formData.append('token', Token);
	formData.append('user', Userkey);
	formData.append('message', scrapedData.tradeInfo);

	fetch(url, {
		method: 'POST',
		body: formData,
	}).catch(error => console.error('PUSHOVER ERROR:', error));
};
