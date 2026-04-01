let saveBtn = document.getElementById("saveTracking")
let trackingKeyInput = document.getElementById("cspTrackingKey")
let trackingSwitch = document.getElementById("trackingSwitch")

document.addEventListener('DOMContentLoaded', function () {
    restoreOptions();
});

function restoreOptions() {
    chrome.storage.sync.get(['trackingApiKey']).then(res => {
        if (!res.trackingApiKey) trackingKeyInput.placeholder = 'Tracking Key'
        if (res.trackingApiKey) trackingKeyInput.placeholder = '*******'
    })

    chrome.storage.sync.get(['enableTracking']).then(res => {
        trackingSwitch.checked = res.enableTracking
    })
}

trackingSwitch.addEventListener('change', function () {
    if (this.checked) {
        chrome.storage.sync.set({
            enableTracking: true,
        });
    } else {
        chrome.storage.sync.set({
            enableTracking: false,
        });
    }
});

saveBtn.addEventListener("click", async function() {
    let promiseStore = [];
    let trackingInputValue = trackingKeyInput.value;

    if (trackingInputValue != '') {
        promiseStore.push(chrome.storage.sync.set({ trackingApiKey: trackingInputValue }));
    }

    await Promise.all(promiseStore);
    callUpdateStorage()
    window.close();
})

function callUpdateStorage() {
    chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
        let activeTab = tabs[0];
        chrome.tabs.sendMessage(activeTab.id, { update: true });
    });
}
