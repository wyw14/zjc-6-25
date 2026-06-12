const API_BASE_URL = 'http://localhost:6054/api';

const CARD_EMOJIS = {
  1: '🍎',
  2: '🍊',
  3: '🍋',
  4: '🍇',
  5: '🍓',
  6: '🍒',
  7: '🍑',
  8: '🥝'
};

const gameBoard = document.getElementById('gameBoard');
const timerEl = document.getElementById('timer');
const movesEl = document.getElementById('moves');
const matchedEl = document.getElementById('matched');
const restartBtn = document.getElementById('restartBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const winModal = document.getElementById('winModal');
const leaderboardModal = document.getElementById('leaderboardModal');
const finalTimeEl = document.getElementById('finalTime');
const finalMovesEl = document.getElementById('finalMoves');
const playerNameInput = document.getElementById('playerName');
const submitScoreBtn = document.getElementById('submitScoreBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
const leaderboardList = document.getElementById('leaderboardList');
const errorToast = document.getElementById('errorToast');
const errorMessage = document.getElementById('errorMessage');

let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let timer = null;
let startTime = null;
let elapsedTime = 0;
let gameStarted = false;
let isProcessing = false;
let isShuffling = false;
let shuffleTimeouts = [];
let errorHideTimeout = null;

async function initGame() {
  if (isShuffling) return;
  
  clearAllShuffleTimeouts();
  hideError();
  resetGameState();
  
  isShuffling = true;
  setButtonsDisabled(true);
  gameBoard.classList.add('animating');
  
  try {
    const shuffledCards = await fetchShuffledCards();
    renderCards(shuffledCards);
    await playShuffleAnimation();
  } catch (error) {
    console.error('Shuffle failed:', error);
    stopShuffleAnimation();
    showError('洗牌失败，请稍后重试');
  } finally {
    isShuffling = false;
    setButtonsDisabled(false);
    gameBoard.classList.remove('animating');
  }
}

function resetGameState() {
  cards = [];
  flippedCards = [];
  matchedPairs = 0;
  moves = 0;
  elapsedTime = 0;
  gameStarted = false;
  isProcessing = false;
  
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  
  updateTimerDisplay();
  movesEl.textContent = '0';
  matchedEl.textContent = '0/8';
  gameBoard.innerHTML = '';
}

function clearAllShuffleTimeouts() {
  shuffleTimeouts.forEach(t => clearTimeout(t));
  shuffleTimeouts = [];
}

function setButtonsDisabled(disabled) {
  restartBtn.disabled = disabled;
  playAgainBtn.disabled = disabled;
}

async function fetchShuffledCards() {
  const response = await fetch(`${API_BASE_URL}/shuffle`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!data.cards || !Array.isArray(data.cards)) {
    throw new Error('Invalid response data');
  }
  return data.cards;
}

function renderCards(cardIds) {
  cardIds.forEach((cardId, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = cardId;
    card.dataset.index = index;
    
    const cardBack = document.createElement('div');
    cardBack.className = 'card-face card-back';
    
    const cardFront = document.createElement('div');
    cardFront.className = 'card-face card-front';
    cardFront.textContent = CARD_EMOJIS[cardId] || '?';
    
    card.appendChild(cardBack);
    card.appendChild(cardFront);
    
    card.addEventListener('click', () => handleCardClick(card));
    
    gameBoard.appendChild(card);
    cards.push(card);
  });
}

function playShuffleAnimation() {
  return new Promise((resolve) => {
    const totalCards = cards.length;
    const shuffleStagger = 40;
    const shuffleDuration = 800;
    const hideDelay = 200;
    const dealInterval = 80;
    
    let completedCount = 0;
    
    const shuffleOrder = [...Array(totalCards).keys()].sort(() => Math.random() - 0.5);
    
    shuffleOrder.forEach((cardIndex, order) => {
      const t1 = setTimeout(() => {
        const card = cards[cardIndex];
        if (card) {
          card.classList.add('shuffle-fly');
          
          const onShuffleEnd = () => {
            card.removeEventListener('animationend', onShuffleEnd);
            card.classList.remove('shuffle-fly');
          };
          card.addEventListener('animationend', onShuffleEnd);
        }
      }, order * shuffleStagger);
      shuffleTimeouts.push(t1);
    });
    
    const allShuffleEndTime = (totalCards - 1) * shuffleStagger + shuffleDuration;
    
    const t2 = setTimeout(() => {
      cards.forEach(card => {
        card.classList.add('pre-deal-hide');
      });
    }, allShuffleEndTime + hideDelay);
    shuffleTimeouts.push(t2);
    
    const dealStartTime = allShuffleEndTime + hideDelay + 200;
    
    cards.forEach((card, index) => {
      const t3 = setTimeout(() => {
        card.classList.remove('pre-deal-hide');
        card.classList.add('deal-in');
        
        const onDealEnd = () => {
          card.removeEventListener('animationend', onDealEnd);
          completedCount++;
          if (completedCount === totalCards) {
            resolve();
          }
        };
        card.addEventListener('animationend', onDealEnd);
      }, dealStartTime + index * dealInterval);
      shuffleTimeouts.push(t3);
    });
    
    const maxWait = dealStartTime + (totalCards * dealInterval) + 1000;
    const t4 = setTimeout(() => {
      resolve();
    }, maxWait);
    shuffleTimeouts.push(t4);
  });
}

function stopShuffleAnimation() {
  clearAllShuffleTimeouts();
  gameBoard.classList.remove('animating');
  cards.forEach(card => {
    card.classList.remove('shuffle-fly');
    card.classList.remove('pre-deal-hide');
    card.classList.add('deal-in');
    card.style.opacity = '1';
  });
}

function showError(message) {
  if (errorHideTimeout) {
    clearTimeout(errorHideTimeout);
  }
  errorMessage.textContent = message;
  errorToast.classList.remove('hidden');
  errorHideTimeout = setTimeout(() => {
    hideError();
  }, 4000);
}

function hideError() {
  if (errorHideTimeout) {
    clearTimeout(errorHideTimeout);
    errorHideTimeout = null;
  }
  errorToast.classList.add('hidden');
}

function handleCardClick(card) {
  if (isShuffling) return;
  if (isProcessing) return;
  if (card.classList.contains('flipped')) return;
  if (card.classList.contains('matched')) return;
  if (flippedCards.length >= 2) return;

  if (!gameStarted) {
    startTimer();
    gameStarted = true;
  }

  flipCard(card);
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    moves++;
    movesEl.textContent = moves;
    checkMatch();
  }
}

function flipCard(card) {
  card.classList.add('flipped');
}

function unflipCard(card) {
  card.classList.remove('flipped');
}

function checkMatch() {
  isProcessing = true;
  
  const [card1, card2] = flippedCards;
  const id1 = parseInt(card1.dataset.id);
  const id2 = parseInt(card2.dataset.id);

  if (id1 === id2) {
    setTimeout(() => {
      card1.classList.add('matched');
      card2.classList.add('matched');
      matchedPairs++;
      matchedEl.textContent = `${matchedPairs}/8`;
      flippedCards = [];
      isProcessing = false;
      
      if (matchedPairs === 8) {
        endGame();
      }
    }, 500);
  } else {
    setTimeout(() => {
      unflipCard(card1);
      unflipCard(card2);
      flippedCards = [];
      isProcessing = false;
    }, 1000);
  }
}

function startTimer() {
  startTime = Date.now() - elapsedTime;
  timer = setInterval(() => {
    elapsedTime = Date.now() - startTime;
    updateTimerDisplay();
  }, 100);
}

function updateTimerDisplay() {
  const totalSeconds = Math.floor(elapsedTime / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function endGame() {
  clearInterval(timer);
  timer = null;
  
  finalTimeEl.textContent = timerEl.textContent;
  finalMovesEl.textContent = moves;
  
  setTimeout(() => {
    winModal.classList.remove('hidden');
  }, 500);
}

async function submitScore() {
  const playerName = playerNameInput.value.trim() || 'Anonymous';
  const timeInSeconds = Math.floor(elapsedTime / 1000);

  try {
    const response = await fetch(`${API_BASE_URL}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        time: timeInSeconds,
        playerName: playerName
      })
    });

    const data = await response.json();
    
    if (data.success) {
      alert(`恭喜！你排名第 ${data.rank} 名！`);
      winModal.classList.add('hidden');
      showLeaderboard();
    }
  } catch (error) {
    console.error('Submit score failed:', error);
    alert('提交成绩失败，请稍后重试');
  }
}

async function showLeaderboard() {
  try {
    const response = await fetch(`${API_BASE_URL}/leaderboard`);
    const data = await response.json();
    renderLeaderboard(data.leaderboard);
  } catch (error) {
    console.error('Get leaderboard failed:', error);
    leaderboardList.innerHTML = '<li>加载排行榜失败</li>';
  }
  
  leaderboardModal.classList.remove('hidden');
}

function renderLeaderboard(leaderboard) {
  if (!leaderboard || leaderboard.length === 0) {
    leaderboardList.innerHTML = '<li class="empty-message">暂无记录，快来挑战吧！</li>';
    return;
  }

  leaderboardList.innerHTML = '';
  
  leaderboard.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'rank-item';
    
    const minutes = Math.floor(entry.time / 60);
    const seconds = entry.time % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    li.innerHTML = `
      <span class="rank-name">
        <span class="rank">#${index + 1}</span>
        <span class="name">${entry.playerName}</span>
      </span>
      <span class="time">${timeStr}</span>
    `;
    
    leaderboardList.appendChild(li);
  });
}

restartBtn.addEventListener('click', initGame);
playAgainBtn.addEventListener('click', () => {
  winModal.classList.add('hidden');
  initGame();
});
leaderboardBtn.addEventListener('click', showLeaderboard);
closeLeaderboardBtn.addEventListener('click', () => {
  leaderboardModal.classList.add('hidden');
});
submitScoreBtn.addEventListener('click', submitScore);

initGame();
