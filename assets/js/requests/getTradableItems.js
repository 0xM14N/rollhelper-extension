let coinsCounter = 0
invFailFetchCount = 0
let afterID = ''

// This function loads all tradable items via roll api
// and creates object with data about each item - this is used later
// to determine correct item to send via steam trade offer (using assetid + float)
const getCurrentSteamInvData  = () => {

    fetch(domainUrl, {
        method: 'POST',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "operationName": "steamInventoryItems",
            "variables": {
                "steamAppName":"CSGO",
                "first":250,
                "userId":userID,
                "after": `${afterID}`
            },
            "extensions":{
                "persistedQuery":{
                    "version":1,
                    "sha256Hash":"01ea308cc60ffbd5a4671fe8e762c45ebced3f51c88b89ac245a9f590000c140"
                }
            }
        }),
        credentials: 'include'
    })
        .then(res => res.json())
        .then(res => {
            let tradeListData = res.data.steamInventoryItems.edges
            let hasNextPage = res.data.steamInventoryItems.pageInfo.hasNextPage
            for (const itemData of tradeListData) {
                let itemValue = itemData.node.itemVariant.value
                coinsCounter += itemValue

                if (itemData.node.tradable === true) {
                    let item = {}
                    let stickers = []
                    if (itemData.node.steamStickersDescriptions.length > 0) {
                        for (const sticker of itemData.node.steamStickersDescriptions) {
                            let name = sticker.name
                            stickers.push(name)
                        }
                    }
                    item.steamExternalId = itemData.node.steamExternalAssetId
                    item.marketName = itemData.node.itemVariant.externalId
                    item.assetID = itemData.node.steamItemIdentifiers.assetId
                    item.itemID = itemData.node.itemVariant.itemId
                    item.stickers = stickers
                    if (itemData.node.steamInspectItem?.paintWear) {
                        item.float = Math.floor(itemData.node.steamInspectItem.paintWear * 1000) / 1000;
                    }
                    itemsList.push(item)
                }
            }
            if (hasNextPage) {
                afterID = res.data.steamInventoryItems.pageInfo.endCursor
                getCurrentSteamInvData()
            }else{
                console.log(`%c[ROLLHELPER] -> Successfully loaded tradable items from steam: (${itemsList.length})`, depositCSSlog)
                try{
                    document.getElementsByClassName('counterCoinButton')[0].innerHTML = Math.round(coinsCounter)
                }catch(err){
                    // ...
                }
            }
        })
        .catch(error => {
            console.log(`%c[ROLLHELPER - ERROR] -> Failed to load the steam inventory data - trying again in 3 seconds`, errorCSSlog)
            console.log(error)
            invFailFetchCount += 1
            setTimeout(()=>{
                if (invFailFetchCount <= 3) {
                    getCurrentSteamInvData()
                }else {
                    console.log(`%c[ROLLHELPER - ERROR] -> Max amount of tries reached - refresh the page to load inventory`, errorCSSlog)
                }
            },3000)
        })
}
