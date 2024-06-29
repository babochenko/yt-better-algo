export const sendMessage = (action, msg) => {
    chrome.runtime.sendMessage({
        action: action,
        ...msg,
    });
}

export const listenMessage = (action, listener) => {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === action) {
            listener(msg, sendResponse);
            return true
        }
    })
}
