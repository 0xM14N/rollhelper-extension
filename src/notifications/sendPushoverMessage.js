const sendPushoverNotification = (message) => {
	const url = 'https://api.pushover.net/1/messages.json';
	const formData = new FormData();
	formData.append('token', Token);
	formData.append('user', Userkey);
	formData.append('message', message);

	fetch(url, {
		method: 'POST',
		body: formData,
	}).catch(error => console.error('PUSHOVER ERROR:', error));
};