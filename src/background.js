let creatingOffscreen = null;
let pendingResolvers = new Map();

async function setupOffscreen() {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }
  creatingOffscreen = chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["WORKERS"],
    justification: "Stockfish analysis worker host.",
  });
  await creatingOffscreen;
  creatingOffscreen = null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze") {
    const { fen, depth } = request;
    const analysisId =
      "an_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

    setupOffscreen()
      .then(() => {
        pendingResolvers.set(analysisId, sendResponse);
        chrome.runtime.sendMessage({
          action: "analyzeLocal",
          fen: fen,
          depth: depth,
          id: analysisId,
        });
      })
      .catch((err) => {
        sendResponse({ error: "Offscreen Setup Failed: " + err.message });
      });

    return true;
  } else if (request.action === "analysisResult") {
    const { result, id } = request;

    if (id && pendingResolvers.has(id)) {
      const resolve = pendingResolvers.get(id);
      resolve(result);
      pendingResolvers.delete(id);
    } else {
      if (pendingResolvers.size === 1) {
        const [pendId, resolve] = pendingResolvers.entries().next().value;
        resolve(result);
        pendingResolvers.delete(pendId);
      }
    }
  } else if (request.action === "stopAnalysis") {
    chrome.runtime.sendMessage({ action: "stopAnalysis" });
    sendResponse({ status: "stopped" });
  }
});
