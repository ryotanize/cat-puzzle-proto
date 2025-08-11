// DOM要素の取得
const gameContainer = document.getElementById('game-container');
const titleScreen = document.getElementById('title-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const satisfiedCatsEl = document.getElementById('satisfied-cats');
const catQueueEl = document.getElementById('cat-queue');
const puzzleBoardEl = document.getElementById('puzzle-board');
const finalScoreEl = document.getElementById('final-score');
const finalSatisfiedCatsEl = document.getElementById('final-satisfied-cats');

// --- ゲームパラメータ（仕様書通り） ---
const INITIAL_TIME = 60;
const TIME_RECOVERY_ON_MATCH = 0.5;
const SCORE_3_MATCH = 30;
const SCORE_4_MATCH = 50;
const SCORE_5_MATCH = 80;
const CHAIN_MULTIPLIER = 1.5;
const CAT_SATISFACTION_BONUS = 500;
const CAT_REQUEST_COUNT_MIN = 8;
const CAT_REQUEST_COUNT_MAX = 15;

const BOARD_SIZE = 8;
const PANEL_TYPES = ['treat', 'toy', 'brush', 'cushion', 'catnip', 'water'];
const PANEL_COLORS = {
    'treat': '#ffb3ba', // パステルレッド
    'toy': '#baffc9',   // パステルグリーン
    'brush': '#bae1ff', // パステルブルー
    'cushion': '#ffffba',// パステルイエロー
    'catnip': '#ffdfba',// パステルオレンジ
    'water': '#e0baff'  // パステルパープル
};

// --- ゲームの状態管理用変数 ---
let score = 0;
let timer = INITIAL_TIME;
let satisfiedCats = 0;
let timerInterval;
let board = []; // 8x8のゲーム盤の状態を保持する2次元配列
let selectedPanel = null; // 選択中のパネル
let catQueue = [];
let nextCatId = 0;

// --- イベントリスナー ---
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', restartGame);


// --- ゲームロジックの関数 ---

/**
 * 画面を切り替える関数
 * @param {string} screenName 'title', 'game', 'result' のいずれか
 */
function showScreen(screenName) {
    // すべての画面を非表示に
    titleScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    resultScreen.classList.remove('active');

    // 指定された画面のみ表示
    if (screenName === 'title') {
        titleScreen.classList.add('active');
    } else if (screenName === 'game') {
        gameScreen.classList.add('active');
    } else if (screenName === 'result') {
        resultScreen.classList.add('active');
    }
}

/**
 * ゲーム開始処理
 */
function startGame() {
    console.log('ゲーム開始！');

    // ゲーム状態のリセット
    score = 0;
    timer = INITIAL_TIME;
    satisfiedCats = 0;
    selectedPanel = null;
    if (timerInterval) clearInterval(timerInterval);

    // UIの初期化
    scoreEl.textContent = score;
    timerEl.textContent = timer;
    satisfiedCatsEl.textContent = satisfiedCats;

    showScreen('game');

    initializeBoard();
    renderBoard();
    initializeCatQueue();

    // タイマーを開始
    timerInterval = setInterval(() => {
        timer--;
        timerEl.textContent = Math.ceil(timer);
        if (timer <= 0) {
            gameOver();
        }
    }, 1000);
}

/**
 * ゲーム終了処理
 */
function gameOver() {
    console.log('ゲームオーバー');
    clearInterval(timerInterval);

    finalScoreEl.textContent = Math.floor(score);
    finalSatisfiedCatsEl.textContent = satisfiedCats;

    showScreen('result');
}

/**
 * ゲームをリスタート（もう一度遊ぶ）
 */
function restartGame() {
    console.log('リスタート');
    clearInterval(timerInterval); // 念のためタイマーを停止
    showScreen('title');
}


// --- マイルストーン1で実装するパズル関連の関数 ---

/**
 * ランダムなパネルの種類を返す
 * @returns {string}
 */
function getRandomPanelType() {
    return PANEL_TYPES[Math.floor(Math.random() * PANEL_TYPES.length)];
}


/**
 * パズル盤面を初期化する
 */
function initializeBoard() {
    board = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        board[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            board[row][col] = getRandomPanelType();
        }
    }

    // 初期マッチがなくなるまで盤面を再生成
    let matches = findAllMatches();
    while (matches.length > 0) {
        matches.forEach(match => {
            match.forEach(p => {
                board[p.row][p.col] = getRandomPanelType();
            });
        });
        matches = findAllMatches();
    }
}

/**
 * パズル盤面をDOMに描画する
 */
function renderBoard() {
    puzzleBoardEl.innerHTML = ''; // 盤面をクリア
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const panelType = board[row][col];
            if (panelType) {
                const panel = document.createElement('div');
                panel.classList.add('panel');
                panel.dataset.row = row;
                panel.dataset.col = col;
                panel.style.backgroundColor = PANEL_COLORS[panelType];
                puzzleBoardEl.appendChild(panel);
            }
        }
    }
}

/**
 * パネルがクリックされたときの処理
 * @param {Event} e
 */
async function onPanelClick(e) {
    // 処理中は操作不可にする
    if (puzzleBoardEl.classList.contains('processing')) return;

    const clickedPanelEl = e.target.closest('.panel');
    if (!clickedPanelEl) return;

    const row = parseInt(clickedPanelEl.dataset.row);
    const col = parseInt(clickedPanelEl.dataset.col);

    if (selectedPanel) {
        const prevSelectedEl = document.querySelector('.panel.selected');
        if(prevSelectedEl) prevSelectedEl.classList.remove('selected');

        // 同じパネルを再クリックした場合は、選択を解除するだけ
        if (selectedPanel.row === row && selectedPanel.col === col) {
            selectedPanel = null;
            return;
        }

        // 隣接しているかチェック
        const isAdjacent = Math.abs(selectedPanel.row - row) + Math.abs(selectedPanel.col - col) === 1;

        if (isAdjacent) {
            await swapAndCheck({row, col}, selectedPanel);
            selectedPanel = null; // スワップ後は選択解除
        } else {
            // 隣接していない場合は、新しいパネルを選択し直す
            selectedPanel = { row, col };
            clickedPanelEl.classList.add('selected');
        }
    } else {
        // 1つ目のパネル選択
        selectedPanel = { row, col };
        clickedPanelEl.classList.add('selected');
    }
}

/**
 * パネルを入れ替え、マッチをチェックして処理を開始する
 * @param {object} p1 {row, col}
 * @param {object} p2 {row, col}
 */
async function swapAndCheck(p1, p2) {
    swapPanels(p1, p2);

    const matches = findAllMatches();
    if (matches.length > 0) {
        puzzleBoardEl.classList.add('processing');
        await handleChainReaction(matches);
        puzzleBoardEl.classList.remove('processing');
    } else {
        // マッチしない場合は元に戻す
        await sleep(100); // 視覚的に戻るのが分かるように少し待つ
        swapPanels(p1, p2); // 再度スワップして元に戻す
        renderBoard();
    }
}

/**
 * 盤面のデータ上でパネルを入れ替える
 * @param {object} p1 {row, col}
 * @param {object} p2 {row, col}
 */
function swapPanels(p1, p2) {
    const temp = board[p1.row][p1.col];
    board[p1.row][p1.col] = board[p2.row][p2.col];
    board[p2.row][p2.col] = temp;
}

/**
 * すべてのマッチを検出する
 * @returns {Array} マッチしたパネルのグループの配列 e.g. [[{r,c}, ...], [{r,c}, ...]]
 */
function findAllMatches() {
    const allMatches = [];
    const checkedPanels = new Set();

    // 水平方向のマッチを検出
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE - 2; c++) {
            const panel1 = board[r][c];
            const panel2 = board[r][c+1];
            const panel3 = board[r][c+2];
            if (panel1 && panel1 === panel2 && panel1 === panel3) {
                const match = [{row: r, col: c}, {row: r, col: c+1}, {row: r, col: c+2}];
                // 4つ以上のマッチを検出
                for (let i = c + 3; i < BOARD_SIZE; i++) {
                    if (board[r][i] === panel1) {
                        match.push({row: r, col: i});
                    } else {
                        break;
                    }
                }
                allMatches.push(match);
                c += match.length - 1;
            }
        }
    }

    // 垂直方向のマッチを検出
    for (let c = 0; c < BOARD_SIZE; c++) {
        for (let r = 0; r < BOARD_SIZE - 2; r++) {
            const panel1 = board[r][c];
            const panel2 = board[r+1][c];
            const panel3 = board[r+2][c];
            if (panel1 && panel1 === panel2 && panel1 === panel3) {
                const match = [{row: r, col: c}, {row: r+1, col: c}, {row: r+2, col: c}];
                 // 4つ以上のマッチを検出
                for (let i = r + 3; i < BOARD_SIZE; i++) {
                    if (board[i][c] === panel1) {
                        match.push({row: i, col: c});
                    } else {
                        break;
                    }
                }
                allMatches.push(match);
                r += match.length - 1;
            }
        }
    }

    // 重複したマッチを統合（L字やT字など）
    const uniqueMatches = [];
    const processedPanels = new Set();
    for (const match of allMatches) {
        const newMatch = [];
        for (const panel of match) {
            const key = `${panel.row},${panel.col}`;
            if (!processedPanels.has(key)) {
                newMatch.push(panel);
                processedPanels.add(key);
            }
        }
        if (newMatch.length > 0) {
            uniqueMatches.push(newMatch);
        }
    }

    return uniqueMatches.flatMap(group => group.length > 0 ? [group] : []);
}


/**
 * マッチしたパネルを消去し、スコアを更新する
 * @param {Array} matches マッチしたパネルのグループの配列
 * @param {number} chainCount 連鎖回数
 * @returns {Array} 消去されたパネルの種類の配列
 */
function clearMatches(matches, chainCount) {
    const clearedPanelTypes = [];
    matches.forEach(match => {
        match.forEach(panel => {
            const panelType = board[panel.row][panel.col];
            if(panelType) {
                clearedPanelTypes.push(panelType);
                board[panel.row][panel.col] = null;
            }
        });
        updateScore(match.length, chainCount);
    });
    return clearedPanelTypes;
}

/**
 * スコアを更新する
 * @param {number} matchLength
 * @param {number} chainCount
 */
function updateScore(matchLength, chainCount) {
    let baseScore = 0;
    if (matchLength === 3) baseScore = SCORE_3_MATCH;
    else if (matchLength === 4) baseScore = SCORE_4_MATCH;
    else if (matchLength >= 5) baseScore = SCORE_5_MATCH;

    const chainBonus = Math.pow(CHAIN_MULTIPLIER, chainCount - 1);
    score += baseScore * chainBonus;
    scoreEl.textContent = Math.floor(score);
}

/**
 * 空白になったマスを埋める（パネルを落下させる）
 */
function dropPanels() {
    for (let c = 0; c < BOARD_SIZE; c++) {
        let emptyRow = BOARD_SIZE - 1;
        for (let r = BOARD_SIZE - 1; r >= 0; r--) {
            if (board[r][c] !== null) {
                if (emptyRow !== r) {
                    swapPanels({row: r, col: c}, {row: emptyRow, col: c});
                }
                emptyRow--;
            }
        }
    }
}

/**
 * 盤面の上部から新しいパネルを補充する
 */
function refillBoard() {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === null) {
                board[r][c] = getRandomPanelType();
            }
        }
    }
}

/**
 * 連鎖処理のメインループ
 * @param {Array} initialMatches 最初のマッチ
 */
async function handleChainReaction(initialMatches) {
    let currentMatches = initialMatches;
    let chainCount = 1;

    while (currentMatches.length > 0) {
        const clearedPanelTypes = clearMatches(currentMatches, chainCount);
        updateCatRequests(clearedPanelTypes);
        await sleep(200);
        renderBoard();

        await sleep(200);
        dropPanels();
        renderBoard();

        await sleep(200);
        refillBoard();
        renderBoard();

        await sleep(200);
        currentMatches = findAllMatches();
        if (currentMatches.length > 0) {
            chainCount++;
        }
    }
}

/**
 * 指定時間待機するヘルパー関数
 * @param {number} ms 待機時間（ミリ秒）
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// --- マイルストーン2で実装する猫関連の関数 ---

/**
 * 猫の待機列を初期化する
 */
function initializeCatQueue() {
    catQueue = [];
    nextCatId = 0;
    for (let i = 0; i < 3; i++) {
        catQueue.push(generateCatRequest());
    }
    renderCatQueue();
}

/**
 * 新しい猫のおねがいを生成する
 * @returns {object} 猫オブジェクト
 */
function generateCatRequest() {
    const type = PANEL_TYPES[Math.floor(Math.random() * PANEL_TYPES.length)];
    const quota = Math.floor(Math.random() * (CAT_REQUEST_COUNT_MAX - CAT_REQUEST_COUNT_MIN + 1)) + CAT_REQUEST_COUNT_MIN;
    return {
        id: nextCatId++,
        type: type,
        initialQuota: quota,
        currentQuota: quota
    };
}

/**
 * 猫の待機列をUIに描画する
 */
function renderCatQueue() {
    catQueueEl.innerHTML = '';
    catQueue.forEach(cat => {
        const catEl = document.createElement('div');
        catEl.classList.add('cat-request');
        catEl.innerHTML = `
            <div class="cat-face">(ΦωΦ)</div>
            <div class="cat-request-details">
                <div class="request-item" style="background-color: ${PANEL_COLORS[cat.type]}"></div>
                <span class="request-text">あと ${cat.currentQuota} 個</span>
            </div>
        `;
        catQueueEl.appendChild(catEl);
    });
}

/**
 * 消されたパネルに応じて猫のノルマを更新する
 * @param {Array} clearedPanelTypes 消されたパネルの種類の配列
 */
function updateCatRequests(clearedPanelTypes) {
    if (clearedPanelTypes.length === 0) return;

    // 時間を回復
    timer += clearedPanelTypes.length * TIME_RECOVERY_ON_MATCH;
    timerEl.textContent = Math.ceil(timer);

    let wasSatisfied = false;
    clearedPanelTypes.forEach(type => {
        catQueue.forEach(cat => {
            if (cat.type === type) {
                cat.currentQuota = Math.max(0, cat.currentQuota - 1);
            }
        });
    });

    // 満足した猫を処理
    const satisfiedCatsInQueue = catQueue.filter(cat => cat.currentQuota === 0);
    if (satisfiedCatsInQueue.length > 0) {
        wasSatisfied = true;
        catQueue = catQueue.filter(cat => cat.currentQuota > 0);

        satisfiedCatsInQueue.forEach(() => {
            satisfiedCats++;
            score += CAT_SATISFACTION_BONUS;
            catQueue.push(generateCatRequest());
        });

        scoreEl.textContent = Math.floor(score);
        satisfiedCatsEl.textContent = satisfiedCats;
    }

    // UIを更新
    renderCatQueue();
}

// --- イベントリスナー ---
// (startButton, restartButtonはファイルの先頭で設定済み)
puzzleBoardEl.addEventListener('click', onPanelClick);

// --- 初期化 ---
showScreen('title');
