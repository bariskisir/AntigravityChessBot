let stockfishWorker = null;
let lastLocalEval = "";
let activeRequestId = null;
let activeResolver = null;
let activeRejecter = null;
let activeRequestData = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeLocal") {
    const { fen, depth, id, multiPv } = request;
    analyzeWithStockfish(fen, depth, id, multiPv)
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

      if (activeResolver) {
        resolveAnalysis(move);
      }
    } else if (line.startsWith("info") && line.includes(" score ") && line.includes(" pv ")) {
      if (!activeRequestData.multiPvInfo) activeRequestData.multiPvInfo = [];

      const multiPvMatch = line.match(/ multipv (\d+) /);
      const pvIndex = multiPvMatch ? parseInt(multiPvMatch[1]) : 1;

      activeRequestData.multiPvInfo[pvIndex - 1] = line;

      if (pvIndex === 1) lastLocalEval = line;
    } else if (line === "readyok") {
      if (isReadyResolver) {
        isReadyResolver();
        isReadyResolver = null;
      }
    }
  };

  function resolveAnalysis(bestMove) {
    if (!activeResolver) return;

    const results = [];
    const lines = activeRequestData.multiPvInfo || [lastLocalEval];

    lines.forEach(line => {
      if (!line) return;
      const moveMatch = line.match(/ pv (\w+)/);
      const evalMatch = line.match(/cp (-?\d+)/);
      const mateMatch = line.match(/mate (-?\d+)/);

      let move = moveMatch ? moveMatch[1] : bestMove;
      let evaluation = 0;
      let mate = null;

      if (mateMatch) {
        mate = parseInt(mateMatch[1]);
        evaluation = mate;
      } else if (evalMatch) {
        evaluation = parseInt(evalMatch[1]) / 100;
      }

      results.push({ move, eval: evaluation, mate });
    });

    if (results.length > 1) {
      activeResolver(results);
    } else if (results.length === 1) {
      activeResolver(results[0]);
    } else {
      activeResolver({ move: bestMove, eval: 0, mate: null });
    }

    cleanupRequest();
  }

  function cleanupRequest() {
    activeResolver = null;
    activeRejecter = null;
    activeRequestId = null;
    activeRequestData = {};
  }
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

async function analyzeWithStockfish(fen, depth, id, multiPv = 1) {
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
      stockfishWorker.postMessage(`setoption name MultiPV value ${multiPv}`);
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
