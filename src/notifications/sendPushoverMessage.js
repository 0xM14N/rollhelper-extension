const sendPushoverNotification = (
	msg,
	{
		priority = 0,
		retry,
		expire,
		sound,
		title,
	} = {}
) => {
	const url = 'https://api.pushover.net/1/messages.json';
	const formData = new FormData();

	formData.append('token', Token);
	formData.append('user', Userkey);
	formData.append('message', msg);
	formData.append('priority', priority);

	if (title) formData.append('title', title);
	if (sound) formData.append('sound', sound);

	if (priority === 2) {
		formData.append('retry', retry ?? 30);
		formData.append('expire', expire ?? 3600);
	}

	fetch(url, {
		method: 'POST',
		body: formData,
	}).catch(err => console.error('PUSHOVER ERROR:', err));
};