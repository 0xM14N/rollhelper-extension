let saveBtn = document.getElementById('savePricing');
let cspApiKeyInput = document.getElementById('cspApiKey');
let pricingSwitch = document.getElementById('pricingOverlay');


pricingSwitch.addEventListener('change', function () {
    if (this.checked) {
        chrome.storage.sync.set({
            enablePricingOverlay: true,
        });
    } else {
        chrome.storage.sync.set({
            enablePricingOverlay: false,
        });
    }
});


saveBtn.addEventListener("click", async function () {
    let promiseStore = [];
    let cspValue = cspApiKeyInput.value;

    if (cspValue != '') {
        promiseStore.push(chrome.storage.sync.set({ cspApi: cspValue }));
    }

    await Promise.all(promiseStore);
    callUpdateStorage()
    window.close();
})


// RESTORE THE UI
document.addEventListener('DOMContentLoaded', function () {
    restoreOptions();
});


function restoreOptions() {
    chrome.storage.sync.get(['cspApi']).then(res => {
        if (!res.cspApi) cspApiKeyInput.placeholder = 'API-KEY';
        if (res.cspApi) cspApiKeyInput.placeholder = '*******';
    });

    chrome.storage.sync.get(['enablePricingOverlay']).then(res => {
        pricingSwitch.checked = res.enablePricingOverlay;
    });


}

function callUpdateStorage() {
    chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
        let activeTab = tabs[0];
        chrome.tabs.sendMessage(activeTab.id, { update: true });
    });
}
