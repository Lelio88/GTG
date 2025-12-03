/**
 * Common utility functions shared across all game modes (full, sound, image, text)
 */

import { abbreviations } from './gamesDatabase.js';

/**
 * Get all profiles from localStorage
 * @returns {Array} Array of profile objects
 */
export function getProfiles() {
    return JSON.parse(localStorage.getItem('profiles')) || [];
}

/**
 * Get the current profile from localStorage
 * @returns {Object|null} Current profile object or null if not found
 */
export function getCurrentProfile() {
    const currentProfilePseudo = localStorage.getItem('currentProfile');
    if (!currentProfilePseudo) {
        return null;
    }
    const profiles = getProfiles();
    return profiles.find(p => p.pseudo === currentProfilePseudo) || null;
}

/**
 * Initialize guessedGamesByMode if it doesn't exist
 * @param {Object} currentProfile - The current profile object
 * @returns {Object} The updated profile object
 */
export function initializeProfile(currentProfile) {
    if (!currentProfile.guessedGamesByMode) {
        currentProfile.guessedGamesByMode = {
            image: [],
            sound: [],
            text: [],
            full: []
        };
    }
    return currentProfile;
}

/**
 * Update the profile with game result
 * @param {Object} currentProfile - The current profile object
 * @param {string} gameTitle - The title of the game
 * @param {boolean} isGoodAnswer - Whether the answer was correct
 * @param {string} gameMode - The game mode ('full', 'sound', 'image', 'text')
 */
export function updateProfile(currentProfile, gameTitle, isGoodAnswer, gameMode) {
    if (isGoodAnswer && !currentProfile.guessedGamesByMode[gameMode].includes(gameTitle)) {
        currentProfile.guessedGamesByMode[gameMode].push(gameTitle);
    }

    if (isGoodAnswer) {
        currentProfile.goodAnswers++;
    } else {
        currentProfile.badAnswers++;
    }

    saveProfile(currentProfile);
}

/**
 * Save profile to localStorage
 * @param {Object} currentProfile - The profile to save
 */
export function saveProfile(currentProfile) {
    const profiles = getProfiles();
    const profileIndex = profiles.findIndex(p => p.pseudo === currentProfile.pseudo);
    profiles[profileIndex] = currentProfile;
    localStorage.setItem('profiles', JSON.stringify(profiles));
}

/**
 * Get available games that haven't been guessed yet in the specified mode
 * @param {Array} games - Array of all games
 * @param {Object} currentProfile - The current profile object
 * @param {string} gameMode - The game mode ('full', 'sound', 'image', 'text')
 * @returns {Array} Array of available games
 */
export function getAvailableGames(games, currentProfile, gameMode) {
    return games.filter(game => !currentProfile.guessedGamesByMode[gameMode].includes(game.title));
}

/**
 * Start the timer and return the interval ID
 * @returns {number} The interval ID
 */
export function startTimer() {
    let seconds = 0;
    return setInterval(() => {
        seconds++;
        document.getElementById('timer').innerText = new Date(seconds * 1000).toISOString().substring(14, 19);
    }, 1000);
}

/**
 * Stop the timer
 * @param {number} timerInterval - The interval ID to clear
 */
export function stopTimer(timerInterval) {
    clearInterval(timerInterval);
}

/**
 * Handle game abandonment
 * @param {Object} currentProfile - The current profile object
 */
export function abandonGame(currentProfile) {
    currentProfile.badAnswers += 10;
    saveProfile(currentProfile);
    document.getElementById('bad-answers').innerText = currentProfile.badAnswers;
    window.location.reload();
}

/**
 * Check if the user's answer is correct
 * @param {string} userInput - The user's input
 * @param {string} gameTitle - The correct game title
 * @returns {boolean} Whether the answer is correct
 */
export function checkAnswerValue(userInput, gameTitle) {
    const input = userInput.trim().toLowerCase();
    const title = gameTitle.trim().toLowerCase();
    
    if (input === title) {
        return true;
    }
    
    if (abbreviations[title] && abbreviations[title].includes(input)) {
        return true;
    }
    
    return false;
}

/**
 * Update the scoreboard display
 * @param {Object} currentProfile - The current profile object
 */
export function updateScoreboard(currentProfile) {
    document.getElementById('good-answers').innerText = currentProfile.goodAnswers;
    document.getElementById('bad-answers').innerText = currentProfile.badAnswers;
}

/**
 * Create a hint navigation system to manage progressive hint unlocking
 * @param {number} totalHints - Total number of hints available
 * @returns {Object} Navigation system object
 */
export function createHintNavigationSystem(totalHints) {
    return {
        currentIndex: 0,
        maxUnlockedIndex: 0,  // At start, only index 0 is accessible
        maxTotalIndex: totalHints - 1,
        
        /**
         * Unlock the next hint
         * @returns {boolean} True if a hint was unlocked, false if all unlocked
         */
        unlockNext() {
            if (this.maxUnlockedIndex < this.maxTotalIndex) {
                this.maxUnlockedIndex++;
                this.currentIndex = this.maxUnlockedIndex;
                return true;
            }
            return false;
        },
        
        /**
         * Navigate to a specific index (only if unlocked)
         * @param {number} index - The index to navigate to
         * @returns {boolean} True if navigation was successful
         */
        navigateTo(index) {
            if (index >= 0 && index <= this.maxUnlockedIndex) {
                this.currentIndex = index;
                return true;
            }
            return false;
        },
        
        /**
         * Check if all hints are unlocked
         * @returns {boolean} True if at the last hint
         */
        isLastUnlocked() {
            return this.maxUnlockedIndex === this.maxTotalIndex;
        },
        
        /**
         * Check if arrows should be displayed (need at least 2 unlocked hints)
         * @returns {boolean} True if arrows should be shown
         */
        shouldShowArrows() {
            return this.maxUnlockedIndex >= 1;
        }
    };
}

/**
 * Create navigation arrows inside content div (preserved by display functions)
 * @param {Function} onNavigate - Callback function for navigation (receives direction: -1 or 1)
 * @returns {boolean} Whether arrows were created
 */
export function createNavigationArrows(onNavigate) {
    // Remove existing arrows if they exist
    removeNavigationArrows();
    
    const gameDiv = document.getElementById('game');
    const contentDiv = document.getElementById('content');
    
    const leftArrow = document.createElement('div');
    leftArrow.className = 'nav-arrow left';
    leftArrow.innerHTML = '&#9664;';
    leftArrow.onclick = () => onNavigate(-1);

    const rightArrow = document.createElement('div');
    rightArrow.className = 'nav-arrow right';
    rightArrow.innerHTML = '&#9654;';
    rightArrow.onclick = () => onNavigate(1);

    // Insert arrows into content div (they will be positioned absolutely)
    contentDiv.appendChild(leftArrow);
    contentDiv.appendChild(rightArrow);

    return true;
}

/**
 * Remove navigation arrows
 */
export function removeNavigationArrows() {
    const arrows = document.querySelectorAll('.nav-arrow');
    arrows.forEach(arrow => arrow.remove());
}

/**
 * Update the visibility of navigation arrows
 * @param {number} currentIndex - The current index
 * @param {number} maxIndex - The maximum index
 * @param {number} minIndex - The minimum index (default: 0)
 */
export function updateArrowsVisibility(currentIndex, maxIndex, minIndex = 0) {
    const leftArrow = document.querySelector('.nav-arrow.left');
    const rightArrow = document.querySelector('.nav-arrow.right');

    if (leftArrow && rightArrow) {
        leftArrow.style.display = currentIndex > minIndex ? 'block' : 'none';
        rightArrow.style.display = currentIndex < maxIndex ? 'block' : 'none';
    }
}

/**
 * Move to the next question by reloading the page
 */
export function nextQuestion() {
    window.location.reload();
}

/**
 * Set up the Enter key handler on the user input field
 * @param {Function} checkAnswerFn - Function to call to check the answer
 * @param {Function} nextQuestionFn - Function to call to go to next question
 * @param {Function} isCorrectAnswerGivenFn - Function that returns whether a correct answer was given
 */
export function setupEnterKeyHandler(checkAnswerFn, nextQuestionFn, isCorrectAnswerGivenFn) {
    document.getElementById('user-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (isCorrectAnswerGivenFn()) {
                nextQuestionFn();
            } else {
                checkAnswerFn();
            }
        }
    });
}

/**
 * Show correct answer feedback
 * @param {string} gameTitle - The game title to reveal
 * @param {number} timerInterval - The timer interval to stop
 */
export function showCorrectAnswerFeedback(gameTitle, timerInterval) {
    document.getElementById('message').innerText = 'Bonne réponse !';
    document.getElementById('message').style.color = 'orange';
    document.getElementById('next-button').style.display = 'block';
    stopTimer(timerInterval);
    document.getElementById('game-title').style.opacity = '1';
}

/**
 * Show incorrect answer feedback
 */
export function showIncorrectAnswerFeedback() {
    document.getElementById('message').innerText = 'Mauvaise réponse !';
    document.getElementById('message').style.color = 'violet';
}

/**
 * Initialize the game title element (hidden initially)
 * @param {string} title - The game title
 */
export function initializeGameTitle(title) {
    const gameTitleElement = document.getElementById('game-title');
    gameTitleElement.innerText = title;
    gameTitleElement.style.opacity = '0';
}
