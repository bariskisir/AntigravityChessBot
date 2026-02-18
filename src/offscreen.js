let stockfishWorker = null;
let lastLocalEval = "";
let activeRequestId = null;
let activeResolver = null;
let activeRejecter = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeLocal") {
    const { fen, depth, id } = request;
    analyzeWithStockfish(fen, depth, id)
      .then((result) => {
        chrome.runtime.sendMessage({
          action: "analysisResult",
          result: result,
          id: id,
        });
      })
      .catch((err) => {
        chrome.runtime.sendMessage({
          action: "analysisResult",
          result: { error: err.message },
          id: id,
        });
      });
  } else if (request.action === "stopAnalysis") {
    stopCurrentAnalysis();
  }
});

function stopCurrentAnalysis() {
  if (stockfishWorker) {
    stockfishWorker.postMessage("stop");
  }
  if (activeRejecter) {
    activeRejecter(new Error("Interrupted by new request or stop command"));
  }
  activeRequestId = null;
  activeResolver = null;
  activeRejecter = null;
}

function initWorker() {
  stockfishWorker = new Worker("stockfish.js");
  stockfishWorker.onmessage = (e) => {
    const line = e.data;
    if (line.startsWith("bestmove")) {
      const move = line.split(" ")[1];
      const evalMatch = lastLocalEval.match(/cp (-?\d+)/);
      const mateMatch = lastLocalEval.match(/mate (-?\d+)/);
      let evaluation = 0;
      let mate = null;
      if (mateMatch) {
        mate = parseInt(mateMatch[1]);
        evaluation = mate;
      } else if (evalMatch) {
        evaluation = parseInt(evalMatch[1]) / 100;
      }
      if (activeResolver) {
        activeResolver({ move: move, eval: evaluation, mate: mate });
        activeResolver = null;
        activeRejecter = null;
        activeRequestId = null;
      }
    } else if (line.includes("score")) {
      lastLocalEval = line;
    } else if (line === "readyok") {
      if (isReadyResolver) {
        isReadyResolver();
        isReadyResolver = null;
      }
    }
  };
  stockfishWorker.onerror = (err) => {
    if (activeRejecter) {
      activeRejecter(new Error(`Worker Error: ${err.message}`));
      activeResolver = null;
      activeRejecter = null;
      activeRequestId = null;
    }
  };
  stockfishWorker.postMessage("uci");
}

let isReadyResolver = null;
function waitReady() {
  return new Promise((resolve) => {
    if (!stockfishWorker) return resolve();
    isReadyResolver = resolve;
    stockfishWorker.postMessage("isready");
    setTimeout(() => {
      if (isReadyResolver) {
        isReadyResolver();
        isReadyResolver = null;
      }
    }, 2000);
  });
}

async function analyzeWithStockfish(fen, depth, id) {
  stopCurrentAnalysis();
  return new Promise(async (resolve, reject) => {
    try {
      if (!stockfishWorker) initWorker();
      activeRequestId = id;
      activeResolver = resolve;
      activeRejecter = reject;
      lastLocalEval = "";
      await waitReady();
      stockfishWorker.postMessage("ucinewgame");
      await waitReady();
      stockfishWorker.postMessage(`position fen ${fen}`);
      stockfishWorker.postMessage(`go depth ${depth}`);
      setTimeout(() => {
        if (activeRequestId === id && activeRejecter) {
          activeRejecter(new Error("Analysis timeout (20s)"));
          activeResolver = null;
          activeRejecter = null;
          activeRequestId = null;
        }
      }, 20000);
    } catch (err) {
      reject(err);
    }
  });
}
