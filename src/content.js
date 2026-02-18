let isAnalyzing = false;
let lastFen = "";
let observer = null;
let modalObserver = null;
let debounceTimer = null;
let hasWhiteKingMoved = false;
let hasBlackKingMoved = false;
let hasWhiteRookAMoved = false;
let hasWhiteRookHMoved = false;
let hasBlackRookAMoved = false;
let hasBlackRookHMoved = false;
let isMoveExecuting = false;
let isRematching = false;
let botSettings = {
  engineType: "local",
  depth: 18,
  thinkingTime: 100,
  autoPlay: true,
  autoPlayDelay: 0,
  autoNewMatch: false,
  autoRematch: false,
  panelPos: { top: "10px", right: "10px" },
};

function createOverlay() {
  if (document.getElementById("bot-overlay-panel")) return;
  const saved = localStorage.getItem("bot-settings");
  if (saved) botSettings = { ...botSettings, ...JSON.parse(saved) };
  const maxDepth = botSettings.engineType === "local" ? 30 : 18;
  botSettings.depth = Math.max(1, Math.min(maxDepth, botSettings.depth));
  botSettings.thinkingTime = Math.max(
    1,
    Math.min(100, botSettings.thinkingTime),
  );
  const panel = document.createElement("div");
  panel.id = "bot-overlay-panel";
  panel.style.top = botSettings.panelPos.top;
  if (botSettings.panelPos.left) {
    panel.style.left = botSettings.panelPos.left;
    panel.style.right = "auto";
  } else {
    panel.style.right = botSettings.panelPos.right;
  }
  panel.innerHTML = `
        <div class="bot-panel-header">
            <h3>ANTIGRAVITY CHESS BOT</h3>
        </div>
        <div class="bot-controls-row">
            <button id="bot-panel-start" class="bot-panel-btn">START</button>
            <button id="bot-panel-stop" class="bot-panel-btn">STOP</button>
        </div>
        <div id="bot-move-display">
            <span class="label">BEST MOVE</span>
            <span class="value" id="best-move-text">---</span>
            <div id="bot-eval-container" class="bot-eval-container">
                <div id="bot-eval-bar" class="bot-eval-bar">
                    <div id="bot-eval-white" class="bot-eval-segment white" style="width: 50%;"></div>
                    <div id="bot-eval-black" class="bot-eval-segment black" style="width: 50%;"></div>
                </div>
                <div id="bot-eval-text" class="bot-eval-text">0.00</div>
            </div>
        </div>
        <div id="bot-status-text" class="bot-status-text">Status: Waiting...</div>
        <div id="bot-panel-footer">
            <button id="bot-advanced-toggle" title="Toggle Settings">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            </button>
        </div>
        <div id="bot-advanced-panel" class="bot-advanced-section">
            <div class="bot-setting-item">
                <label>
                    <span>ENGINE</span>
                </label>
                <select id="bot-engine-select" style="width: 100%; padding: 6px; background: #374151; color: #f3f4f6; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; cursor: pointer; font-size: 12px;">
                    <option value="api" ${botSettings.engineType === "api" ? "selected" : ""} style="background: #374151; color: #f3f4f6;">chess-api.com-stockfish-17</option>
                    <option value="local" ${botSettings.engineType === "local" ? "selected" : ""} style="background: #374151; color: #f3f4f6;">local-stockfish-18</option>
                </select>
            </div>
            <div class="bot-setting-item">
                <label style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <span>AUTO PLAY</span>
                    <input type="checkbox" id="bot-auto-play" ${botSettings.autoPlay ? "checked" : ""} style="margin: 0; cursor: pointer;">
                </label>
            </div>
            <div class="bot-setting-item">
                <label style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <span>AUTO NEW MATCH</span>
                    <input type="checkbox" id="bot-auto-new-match" ${botSettings.autoNewMatch ? "checked" : ""} style="margin: 0; cursor: pointer;">
                </label>
            </div>
            <div class="bot-setting-item">
                <label style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <span>AUTO REMATCH</span>
                    <input type="checkbox" id="bot-auto-rematch" ${botSettings.autoRematch ? "checked" : ""} style="margin: 0; cursor: pointer;">
                </label>
            </div>
            <div class="bot-setting-item">
                <label>
                    <span>AUTO PLAY DELAY (S)</span>
                    <span id="delay-val">${botSettings.autoPlayDelay}</span>
                </label>
                <input type="range" id="bot-delay-slider" min="0" max="10" value="${botSettings.autoPlayDelay}">
            </div>
            <div class="bot-setting-item">
                <label>
                    <span>DEPTH</span>
                    <span id="depth-val">${botSettings.depth}</span>
                </label>
                <input type="range" id="bot-depth-slider" min="1" max="${botSettings.engineType === "local" ? 30 : 18}" value="${botSettings.depth}">
            </div>
            <div class="bot-setting-item" id="thinking-time-container" style="display: ${botSettings.engineType === "local" ? "none" : "block"};">
                <label>
                    <span>THINKING TIME (MS)</span>
                    <span id="time-val">${botSettings.thinkingTime}</span>
                </label>
                <input type="range" id="bot-time-slider" min="1" max="100" value="${botSettings.thinkingTime}">
            </div>
            <div class="bot-debug-container">
                <span class="label">FEN</span>
                <div id="bot-fen-text" class="debug-text" style="font-size: 8px;">---</div>
            </div>
        </div>
    `;
  document.body.appendChild(panel);
  const toggleBtn = document.getElementById("bot-advanced-toggle");
  const advPanel = document.getElementById("bot-advanced-panel");
  toggleBtn.addEventListener("click", () => {
    const isOpen = advPanel.classList.toggle("open");
    toggleBtn.classList.toggle("open", isOpen);
  });
  const depthSlider = document.getElementById("bot-depth-slider");
  const timeSlider = document.getElementById("bot-time-slider");
  const autoPlayCheck = document.getElementById("bot-auto-play");
  const autoRematchCheck = document.getElementById("bot-auto-rematch");
  const autoNewMatchCheck = document.getElementById("bot-auto-new-match");
  autoPlayCheck.addEventListener("change", (e) => {
    botSettings.autoPlay = e.target.checked;
    saveSettings();
  });
  autoRematchCheck.addEventListener("change", (e) => {
    botSettings.autoRematch = e.target.checked;
    saveSettings();
  });
  autoNewMatchCheck.addEventListener("change", (e) => {
    botSettings.autoNewMatch = e.target.checked;
    saveSettings();
  });
  depthSlider.addEventListener("input", (e) => {
    botSettings.depth = parseInt(e.target.value);
    document.getElementById("depth-val").innerText = botSettings.depth;
    saveSettings();
  });
  timeSlider.addEventListener("input", (e) => {
    botSettings.thinkingTime = parseInt(e.target.value);
    document.getElementById("time-val").innerText = botSettings.thinkingTime;
    saveSettings();
  });
  document.getElementById("bot-delay-slider").addEventListener("input", (e) => {
    botSettings.autoPlayDelay = parseInt(e.target.value);
    document.getElementById("delay-val").innerText = botSettings.autoPlayDelay;
    saveSettings();
  });
  document
    .getElementById("bot-engine-select")
    .addEventListener("change", (e) => {
      botSettings.engineType = e.target.value;
      const timeBox = document.getElementById("thinking-time-container");
      if (timeBox) {
        timeBox.style.display =
          botSettings.engineType === "local" ? "none" : "block";
      }

      const dSlider = document.getElementById("bot-depth-slider");
      if (dSlider) {
        const newMax = botSettings.engineType === "local" ? 30 : 18;
        dSlider.max = newMax;
        if (botSettings.depth > newMax) {
          botSettings.depth = newMax;
          dSlider.value = newMax;
          const dVal = document.getElementById("depth-val");
          if (dVal) dVal.innerText = newMax;
        }
      }

      if (botSettings.engineType !== "local") {
        chrome.runtime.sendMessage({ action: "stopAnalysis" });
      }
      saveSettings();
    });
  const header = panel.querySelector(".bot-panel-header");
  let isDragging = false;
  let offsetX, offsetY;
  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - panel.offsetLeft;
    offsetY = e.clientY - panel.offsetTop;
    header.style.cursor = "grabbing";
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    panel.style.left = x + "px";
    panel.style.top = y + "px";
    panel.style.right = "auto";
  });
  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      header.style.cursor = "grab";
      botSettings.panelPos = {
        top: panel.style.top,
        left: panel.style.left,
      };
      saveSettings();
    }
  });
  document.getElementById("bot-panel-start").addEventListener("click", () => {
    isAnalyzing = true;
    lastFen = "";
    startDetection();
    setStatus("Analyzing Board", "#10b981");
  });
  document.getElementById("bot-panel-stop").addEventListener("click", () => {
    isAnalyzing = false;
    stopDetection();
    setStatus("Stopped", "#ef4444");
  });
}
function saveSettings() {
  localStorage.setItem("bot-settings", JSON.stringify(botSettings));
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start") {
    createOverlay();
    sendResponse({ status: "injected" });
  }
});
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createOverlay);
} else {
  createOverlay();
}
function startDetection() {
  calculateBestMove();
  const board = document.querySelector("wc-chess-board");
  if (!board) return;
  if (observer) observer.disconnect();
  observer = new MutationObserver((mutations) => {
    checkGameEnd();
    const isRealChange = mutations.some((m) => {
      if (
        m.target &&
        (m.target.id?.includes("bot-overlay") ||
          m.target.classList?.contains("custom-bot-highlight"))
      ) {
        return false;
      }
      return true;
    });
    if (isRealChange) {
      calculateBestMove();
    }
  });
  observer.observe(board, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  if (modalObserver) modalObserver.disconnect();
  modalObserver = new MutationObserver(() => {
    checkGameEnd();
  });
  modalObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  checkGameEnd();
}
function checkGameEnd() {
  if (isRematching) return;
  const modal =
    document.querySelector(".game-over-modal-content") ||
    document.querySelector(".game-over-modal-container") ||
    document.querySelector(".board-modal-modal") ||
    document.querySelector(".game-over-modal-component") ||
    document.querySelector(".game-result-overlay");

  const newMatchBtn =
    document.querySelector('[data-cy="game-over-modal-new-game-button"]') ||
    document.querySelector('[data-cy="next-arena-game-button"]');
  const rematchBtn =
    document.querySelector('button[data-control="rematch"]') ||
    document.querySelector(
      ".game-over-button-component.game-over-button-primary",
    );

  if (modal || newMatchBtn || rematchBtn) {
    if (botSettings.autoNewMatch && newMatchBtn) {
      isRematching = true;
      isAnalyzing = false;
      stopDetection();
      setStatus("Game Over - Waiting 2.5s for New Game...", "#f59e0b");
      setTimeout(() => {
        newMatchBtn.click();
        setStatus("New Game clicked - Waiting 2.5s...", "#3b82f6");
        setTimeout(() => {
          isRematching = false;
          isAnalyzing = true;
          lastFen = "";
          startDetection();
          setStatus("New Game Started", "#10b981");
        }, 2500);
      }, 2500);
      return;
    }

    if (botSettings.autoRematch) {
      const finalRematchBtn =
        rematchBtn ||
        Array.from(document.querySelectorAll("button")).find((b) =>
          b.innerText.includes("Rematch"),
        );
      if (finalRematchBtn) {
        isRematching = true;
        isAnalyzing = false;
        stopDetection();
        setStatus("Game Over - Waiting 2.5s for Rematch...", "#f59e0b");
        setTimeout(() => {
          finalRematchBtn.click();
          setStatus("Rematch clicked - Waiting 2.5s...", "#3b82f6");
          setTimeout(() => {
            isRematching = false;
            isAnalyzing = true;
            lastFen = "";
            startDetection();
            setStatus("New Game Started", "#10b981");
          }, 2500);
        }, 2500);
      }
    }
  }
}
function stopDetection() {
  if (observer) observer.disconnect();
  if (modalObserver) modalObserver.disconnect();
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  isMoveExecuting = false;
  clearHighlights();
  updateBestMoveText("----");
}
function updateBestMoveText(move) {
  const el = document.getElementById("best-move-text");
  if (el) el.innerText = move.toUpperCase();
}
function getTurn() {
  const boardEl = document.querySelector("wc-chess-board");
  if (!boardEl) return "w";
  const moveList = document.querySelector("wc-simple-move-list");
  if (moveList) {
    const selectedNode = moveList.querySelector(".node.selected");
    if (selectedNode) {
      return selectedNode.classList.contains("white-move") ? "b" : "w";
    }
    const rows = moveList.querySelectorAll(".main-line-row");
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      const nodes = lastRow.querySelectorAll(".node");
      if (nodes.length === 1) return "b";
      if (nodes.length === 2) return "w";
    } else {
      return "w";
    }
  }
  const bottomPlayer = document.querySelector("#board-layout-player-bottom");
  const topPlayer = document.querySelector("#board-layout-player-top");
  if (
    bottomPlayer &&
    (bottomPlayer.querySelector(".clock-player-turn") ||
      bottomPlayer.querySelector(".player-info.active"))
  ) {
    return boardEl.classList.contains("flipped") ? "b" : "w";
  }
  if (
    topPlayer &&
    (topPlayer.querySelector(".clock-player-turn") ||
      topPlayer.querySelector(".player-info.active"))
  ) {
    return boardEl.classList.contains("flipped") ? "w" : "b";
  }
  return "w";
}
function getFen() {
  const boardEl = document.querySelector("wc-chess-board");
  if (!boardEl) return "";
  const pieces = boardEl.querySelectorAll(".piece");
  const board = Array(8)
    .fill(null)
    .map(() => Array(8).fill(" "));
  pieces.forEach((piece) => {
    let type = "";
    let file = -1;
    let rank = -1;
    for (const cls of piece.classList) {
      const typeMatch = cls.match(/^([wb][prnbqk])$/);
      if (typeMatch) {
        type = typeMatch[1];
      }
      const sqMatch = cls.match(/square-(\d)(\d)/);
      if (sqMatch) {
        file = parseInt(sqMatch[1]);
        rank = parseInt(sqMatch[2]);
      }
    }
    if (type && file !== -1 && rank !== -1) {
      let fenChar = type[1];
      if (type[0] === "w") fenChar = fenChar.toUpperCase();
      const row = 8 - rank;
      const col = file - 1;
      if (row >= 0 && row < 8 && col >= 0 && col < 8) {
        board[row][col] = fenChar;
      }
    }
  });

  let fenRows = board.map((row) => {
    let fenRow = "";
    let emptyCount = 0;
    for (let char of row) {
      if (char === " ") {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          fenRow += emptyCount;
          emptyCount = 0;
        }
        fenRow += char;
      }
    }
    if (emptyCount > 0) fenRow += emptyCount;
    return fenRow;
  });

  const turn = getTurn();
  const castling = getCastlingRights(board);

  let moveNum = 1;
  const moveList = document.querySelector("wc-simple-move-list");
  if (moveList) {
    const moves = moveList.querySelectorAll(".main-line-row");
    moveNum = moves.length || 1;
    if (turn === "w" && moves.length > 0) {
      const lastRowNodes = moves[moves.length - 1].querySelectorAll(".node");
      if (lastRowNodes.length === 2) moveNum++;
    }
  }

  const finalFen = fenRows.join("/") + ` ${turn} ${castling} - 0 ${moveNum}`;
  const fenEl = document.getElementById("bot-fen-text");
  if (fenEl) fenEl.innerText = finalFen;
  return finalFen;
}

async function calculateBestMove() {
  if (!isAnalyzing) return;
  if (isMoveExecuting) return;

  const promoWindow = document.querySelector(".promotion-window");
  if (promoWindow && promoWindow.offsetParent !== null) return;

  const boardEl = document.querySelector("wc-chess-board");
  if (
    boardEl &&
    (boardEl.classList.contains("dragging") ||
      boardEl.querySelector(".piece.dragging"))
  ) {
    return;
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    if (!isAnalyzing || isRematching) return;
    const currentFen = getFen();
    if (!currentFen) {
      setStatus("Waiting for board...", "#f59e0b");
      return;
    }

    const turn = currentFen.split(" ")[1];
    const userColor = getUserColor();

    if (currentFen === lastFen) return;
    lastFen = currentFen;

    setStatus("Thinking...", "#3b82f6");
    const startTime = Date.now();

    try {
      let data;
      if (botSettings.engineType === "api") {
        const response = await fetch("https://chess-api.com/v1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fen: currentFen,
            depth: botSettings.depth,
          }),
        });
        if (!response.ok) {
          const err = "API Error: " + response.status;
          setStatus(err, "#ef4444");
          return;
        }
        data = await response.json();
      } else {
        data = await askLocalStockfish(currentFen, botSettings.depth);
      }

      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, botSettings.thinkingTime - elapsed);
      setTimeout(() => {
        handleResult(data, turn, userColor);
      }, remainingDelay);
    } catch (error) {
      setStatus("Engine Error", "#ef4444");
    }
  }, 400);
}

async function askLocalStockfish(fen, depth) {
  const fenParts = fen.split(" ");
  const turn = fenParts[1] || "w";

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "analyze",
        fen: fen,
        depth: depth,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          if (turn === "b" && response && response.eval !== undefined) {
            response.eval = -response.eval;
          }
          if (turn === "b" && response && response.mate !== null && response.mate !== undefined) {
            response.mate = -response.mate;
          }
          resolve(response);
        }
      },
    );
  });
}

function handleResult(data, turn, userColor) {
  updateEvalBar(data);

  if (turn === userColor) {
    if (data && data.move) {
      updateBestMoveText(data.move);
      setStatus("Analyzing Board", "#10b981");
      if (!botSettings.autoPlay) {
        highlightMove(data.move);
      } else {
        clearHighlights();
        executeMove(data.move);
      }
    } else {
      const msg = data.error || "No move found";
      setStatus(msg, "#ef4444");
    }
  } else {
    setStatus("Opponent's turn", "#9ca3af");
    clearHighlights();
    updateBestMoveText("---");
  }
}

function setStatus(text, color) {
  const el = document.getElementById("bot-status-text");
  if (el) {
    el.innerText = "Status: " + text;
    if (color) el.style.color = color;
  }
}

function showResult(data) {
  updateBestMoveText(data.move);
  highlightMove(data.move);
}

function updateEvalBar(data) {
  const container = document.getElementById("bot-eval-container");
  const whiteSeg = document.getElementById("bot-eval-white");
  const blackSeg = document.getElementById("bot-eval-black");
  const text = document.getElementById("bot-eval-text");
  if (!container || !whiteSeg || !blackSeg || !text) return;

  const userColor = getUserColor();
  const evalValue = data.eval || 0;
  const evalPrefix = evalValue > 0 ? "+" : "";

  text.innerText = data.mate
    ? evalValue > 0
      ? "M" + evalValue
      : "-M" + Math.abs(evalValue)
    : evalPrefix + evalValue.toFixed(2);

  let whitePct = 50;
  if (data.mate) {
    whitePct = evalValue > 0 ? 100 : 0;
  } else {
    const cappedEval = Math.max(-10, Math.min(10, evalValue));
    whitePct = 50 + (cappedEval / 10) * 50;
  }

  let dividerPct = 0;
  if (userColor === "w") {
    whiteSeg.style.width = whitePct + "%";
    blackSeg.style.width = 100 - whitePct + "%";
    whiteSeg.style.order = "1";
    blackSeg.style.order = "2";
    dividerPct = whitePct;
  } else {
    blackSeg.style.width = 100 - whitePct + "%";
    whiteSeg.style.width = whitePct + "%";
    blackSeg.style.order = "1";
    whiteSeg.style.order = "2";
    dividerPct = 100 - whitePct;
  }

  text.style.left = dividerPct + "%";

  const isWhiteWinner = evalValue > 0;
  const isUserWinner =
    (userColor === "w" && isWhiteWinner) ||
    (userColor === "b" && !isWhiteWinner);

  if (isUserWinner) {
    text.style.transform = "translateX(-100%)";
    text.style.color = userColor === "w" ? "#000000" : "#ffffff";
  } else {
    text.style.transform = "translateX(0%)";
    text.style.color = userColor === "w" ? "#ffffff" : "#000000";
  }
}

function highlightMove(move) {
  clearHighlights();
  const board = document.querySelector("wc-chess-board");
  if (!board || !move) return;

  const from = move.slice(0, 2);
  const to = move.slice(2, 4);

  addHighlight(board, from, "rgba(16, 185, 129, 0.4)");
  addHighlight(board, to, "rgba(16, 185, 129, 0.7)");
}

function getUserColor() {
  const board = document.querySelector("wc-chess-board");
  if (!board) return "w";
  return board.classList.contains("flipped") ? "b" : "w";
}

function addHighlight(board, square, color) {
  if (!square || square.length < 2) return;
  const file = square.charCodeAt(0) - 96;
  const rank = parseInt(square[1]);
  const isFlipped = board.classList.contains("flipped");

  let x = (file - 1) * 100;
  let y = (8 - rank) * 100;

  if (isFlipped) {
    x = (8 - file) * 100;
    y = (rank - 1) * 100;
  }

  const hl = document.createElement("div");
  hl.className = "highlight custom-bot-highlight";
  hl.style.backgroundColor = color;
  hl.style.transform = `translate(${x}%, ${y}%)`;
  hl.style.zIndex = "1";
  board.appendChild(hl);
}

function clearHighlights() {
  document
    .querySelectorAll(".custom-bot-highlight")
    .forEach((el) => el.remove());
}

function getCastlingRights(board) {
  const moveList = document.querySelector("wc-simple-move-list");
  let wK = true,
    wQ = true,
    bK = true,
    bQ = true;

  if (board[7][4] !== "K") {
    wK = false;
    wQ = false;
  }
  if (board[7][7] !== "R") {
    wK = false;
  }
  if (board[7][0] !== "R") {
    wQ = false;
  }

  if (board[0][4] !== "k") {
    bK = false;
    bQ = false;
  }
  if (board[0][7] !== "r") {
    bK = false;
  }
  if (board[0][0] !== "r") {
    bQ = false;
  }

  if (moveList) {
    const moves = moveList.querySelectorAll(".node");
    moves.forEach((node) => {
      const text = node.innerText.trim();
      const isWhite = node.classList.contains("white-move");
      if (isWhite) {
        if (text.startsWith("K") || text.includes("O-O")) {
          wK = false;
          wQ = false;
        }
        if (text.includes("O-O-O")) {
          wK = false;
          wQ = false;
        } else if (text.includes("O-O")) {
          wK = false;
          wQ = false;
        }
      } else {
        if (text.startsWith("K") || text.includes("O-O")) {
          bK = false;
          bQ = false;
        }
        if (text.includes("O-O-O")) {
          bK = false;
          bQ = false;
        } else if (text.includes("O-O")) {
          bK = false;
          bQ = false;
        }
      }
    });
  }

  let rights = "";
  if (wK) rights += "K";
  if (wQ) rights += "Q";
  if (bK) rights += "k";
  if (bQ) rights += "q";

  return rights || "-";
}

async function executeMove(moveUci) {
  if (!moveUci || moveUci.length < 4 || isMoveExecuting) return;
  isMoveExecuting = true;

  try {
    if (botSettings.autoPlayDelay > 0) {
      await new Promise((r) => setTimeout(r, botSettings.autoPlayDelay * 1000));
    }

    const fromStr = moveUci.slice(0, 2);
    const toStr = moveUci.slice(2, 4);
    const promoChar = moveUci.length > 4 ? moveUci[4].toLowerCase() : null;

    const board = document.querySelector("wc-chess-board");
    if (!board) throw new Error("Board not found");

    const simulateClick = (target) => {
      let clientX, clientY;
      let dispatcher = board;

      if (typeof target === "string") {
        const file = target.charCodeAt(0) - 96;
        const rank = parseInt(target[1]);
        const isFlipped = board.classList.contains("flipped");

        let x = (file - 1) * 12.5 + 6.25;
        let y = (8 - rank) * 12.5 + 6.25;

        if (isFlipped) {
          x = (8 - file) * 12.5 + 6.25;
          y = (rank - 1) * 12.5 + 6.25;
        }

        const rect = board.getBoundingClientRect();
        clientX = rect.left + (rect.width * x) / 100;
        clientY = rect.top + (rect.height * y) / 100;
      } else if (target instanceof HTMLElement) {
        const rect = target.getBoundingClientRect();
        clientX = rect.left + rect.width / 2;
        clientY = rect.top + rect.height / 2;
        dispatcher = target;
      }

      const options = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: clientX,
        clientY: clientY,
        button: 0,
        pointerId: 1,
        isPrimary: true,
      };

      const eventTypes = [
        "pointerdown",
        "mousedown",
        "pointerup",
        "mouseup",
        "click",
      ];
      eventTypes.forEach((type) => {
        const EvtClass = type.startsWith("pointer") ? PointerEvent : MouseEvent;
        dispatcher.dispatchEvent(new EvtClass(type, options));
      });
    };

    simulateClick(fromStr);
    await new Promise((r) => setTimeout(r, 150));
    simulateClick(toStr);

    if (promoChar) {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 100));

        const userColor = getUserColor();
        const targetPiece = userColor + promoChar;

        const promoBtn =
          document.querySelector(`.promotion-piece.${targetPiece}`) ||
          document.querySelector(`.promotion-piece[class*="${targetPiece}"]`) ||
          document.querySelector(`.promotion-piece[class*="${promoChar}"]`);

        if (promoBtn && promoBtn.offsetParent !== null) {
          await new Promise((r) => setTimeout(r, 200));
          simulateClick(promoBtn);
          promoBtn.click();
          break;
        }
      }
    }
  } catch (e) {
    console.error("ExecuteMove Error:", e);
  } finally {
    setTimeout(() => {
      isMoveExecuting = false;
      lastFen = "";
      if (isAnalyzing) calculateBestMove();
    }, 400);
  }
}
