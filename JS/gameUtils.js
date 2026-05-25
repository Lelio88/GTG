/**
 * Common utility functions shared across all game modes (full, sound, image, text)
 */

import { abbreviations } from './gamesDatabase.js';
import { showAlert, ensureStyles as ensureDialogStyles } from './ui/dialog.js';

/**
 * Get all profiles from localStorage.
 * Resiste a un localStorage indisponible (mode prive Safari, quota 0) ou a un JSON corrompu.
 * @returns {Array} Array of profile objects (vide si absent / illisible)
 */
export function getProfiles() {
    try {
        const raw = localStorage.getItem('profiles');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error('Profils corrompus dans localStorage :', err);
        return [];
    }
}

/**
 * Persiste un tableau de profils dans localStorage avec gestion d'erreurs.
 * En cas de QuotaExceededError, avertit l'utilisateur et l'oriente vers l'export.
 * @param {Array} profiles - Tableau de profils a sauvegarder
 * @returns {boolean} true si la sauvegarde a reussi, false sinon
 */
export function saveProfiles(profiles) {
    try {
        localStorage.setItem('profiles', JSON.stringify(profiles));
        return true;
    } catch (err) {
        // Quota depasse : alerter sans tuer l'UI
        if (err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014)) {
            showAlert('Exporte ta progression puis supprime un profil pour liberer de la place.', {
                title: 'Espace de sauvegarde plein',
            });
        } else {
            console.error('Echec de sauvegarde des profils :', err);
            showAlert('Verifie la console pour les details.', { title: 'Erreur de sauvegarde' });
        }
        return false;
    }
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
 * Initialize guessedGamesByMode and scoresByMode if they don't exist
 * @param {Object} currentProfile - The current profile object
 * @returns {Object} The updated profile object
 */
export function initializeProfile(currentProfile) {
    const modes = ['image', 'sound', 'text', 'full', 'midi', 'shadow', 'pixelated', 'emoji'];

    // Initialisation des jeux devinés
    if (!currentProfile.guessedGamesByMode) {
        currentProfile.guessedGamesByMode = {};
        modes.forEach(mode => currentProfile.guessedGamesByMode[mode] = []);
    }

    // NOUVEAU : Initialisation des scores par mode
    if (!currentProfile.scoresByMode) {
        currentProfile.scoresByMode = {};
        modes.forEach(mode => {
            currentProfile.scoresByMode[mode] = { goodAnswers: 0, badAnswers: 0 };
        });
    } else {
        // Sécurité : s'assurer que tous les modes existent même pour les anciens profils
        modes.forEach(mode => {
            if (!currentProfile.scoresByMode[mode]) {
                currentProfile.scoresByMode[mode] = { goodAnswers: 0, badAnswers: 0 };
            }
        });
    }
    return currentProfile;
}

/**
 * Update the profile with game result specific to the mode
 * @param {Object} currentProfile - The current profile object
 * @param {string} gameTitle - The title of the game
 * @param {boolean} isGoodAnswer - Whether the answer was correct
 * @param {string} gameMode - The game mode ('full', 'sound', 'image', 'text', etc.)
 */
export function updateProfile(currentProfile, gameTitle, isGoodAnswer, gameMode) {
    // S'assurer que la structure existe (sécurité supplémentaire)
    if (!currentProfile.scoresByMode || !currentProfile.scoresByMode[gameMode]) {
        currentProfile = initializeProfile(currentProfile);
    }
    if (isGoodAnswer && !currentProfile.guessedGamesByMode[gameMode].includes(gameTitle)) {
        currentProfile.guessedGamesByMode[gameMode].push(gameTitle);
    }
    if (isGoodAnswer) {
        // Modifie uniquement le score du mode actuel
        currentProfile.scoresByMode[gameMode].goodAnswers++;
    } else {
        // Modifie uniquement le score du mode actuel
        currentProfile.scoresByMode[gameMode].badAnswers++;
    }
    saveProfile(currentProfile);
}

/**
 * Save a single profile to localStorage.
 * Si le profil n'est pas trouve dans la liste, ne tente pas de l'inserer (silencieux par design).
 * @param {Object} currentProfile - The profile to save
 * @returns {boolean} true si la sauvegarde a reussi, false sinon
 */
export function saveProfile(currentProfile) {
    const profiles = getProfiles();
    const profileIndex = profiles.findIndex(p => p.pseudo === currentProfile.pseudo);
    if (profileIndex === -1) {
        console.warn(`saveProfile: profil "${currentProfile.pseudo}" introuvable, sauvegarde ignoree.`);
        return false;
    }
    profiles[profileIndex] = currentProfile;
    return saveProfiles(profiles);
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
 * Handle game abandonment.
 * Applique la penalite (+10 bad answers), persiste, met a jour le scoreboard,
 * puis enchaine la question suivante via nextFn si fourni (in-place reset).
 * Fallback: window.location.reload() si nextFn absent (compat).
 * @param {Object} currentProfile - The current profile object
 * @param {string} gameMode - The current game mode (required to apply penalty)
 * @param {Function} [nextFn] - Callback pour enchainer sans reload
 */
export function abandonGame(currentProfile, gameMode, nextFn) {
    if (!gameMode || !currentProfile.scoresByMode[gameMode]) {
        console.error("Game mode missing for abandonment penalty");
        return;
    }
    currentProfile.scoresByMode[gameMode].badAnswers += 10;
    saveProfile(currentProfile);
    document.getElementById('bad-answers').innerText = currentProfile.scoresByMode[gameMode].badAnswers;
    if (typeof nextFn === 'function') {
        nextFn();
    } else {
        window.location.reload();
    }
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
 * Update the scoreboard display based on current mode
 * @param {Object} currentProfile - The current profile object
 * @param {string} gameMode - The current game mode (Required to show correct score)
 */
export function updateScoreboard(currentProfile, gameMode) {
    // Fallback si le mode n'est pas encore initialisé
    const stats = currentProfile.scoresByMode && currentProfile.scoresByMode[gameMode] 
        ? currentProfile.scoresByMode[gameMode] 
        : { goodAnswers: 0, badAnswers: 0 };
    document.getElementById('good-answers').innerText = stats.goodAnswers;
    document.getElementById('bad-answers').innerText = stats.badAnswers;
}

/**
 * Create a hint navigation system to manage progressive hint unlocking
 * @param {number} totalHints - Total number of hints available (must be >= 1)
 * @returns {Object} Navigation system object with methods to manage hints
 */
export function createHintNavigationSystem(totalHints) {
    const validatedTotal = Math.max(1, totalHints || 1);
    return {
        currentIndex: 0,
        maxUnlockedIndex: 0,  // Initially, only hint 0 is accessible
        maxTotalIndex: validatedTotal - 1,
        
        unlockNext() {
            if (this.maxUnlockedIndex < this.maxTotalIndex) {
                this.maxUnlockedIndex++;
                this.currentIndex = this.maxUnlockedIndex;
                return true;
            }
            return false;
        },
        
        navigateTo(index) {
            if (index >= 0 && index <= this.maxUnlockedIndex) {
                this.currentIndex = index;
                return true;
            }
            return false;
        },
        
        isLastUnlocked() {
            return this.maxUnlockedIndex === this.maxTotalIndex;
        },
        
        shouldShowArrows() {
            return this.maxUnlockedIndex >= 1;
        }
    };
}

/**
 * Remove navigation arrows from the DOM
 */
export function removeNavigationArrows() {
    const arrows = document.querySelectorAll('.nav-arrow');
    arrows.forEach(arrow => arrow.remove());
}

/**
 * Create navigation arrows
 * @param {Function} onNavigate - Callback function for navigation (receives direction: -1 or 1)
 * @returns {boolean} Whether arrows were created
 */
export function createNavigationArrows(onNavigate) {
    // Remove old arrows if they exist
    removeNavigationArrows();
    
    const gameDiv = document.getElementById('game');

    const leftArrow = document.createElement('div');
    leftArrow.className = 'nav-arrow left';
    leftArrow.innerHTML = '&#9664;';
    leftArrow.onclick = () => onNavigate(-1);

    const rightArrow = document.createElement('div');
    rightArrow.className = 'nav-arrow right';
    rightArrow.innerHTML = '&#9654;';
    rightArrow.onclick = () => onNavigate(1);

    gameDiv.appendChild(leftArrow);
    gameDiv.appendChild(rightArrow);

    return true;
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
 * Move to the next question by reloading the page.
 * @deprecated Prefer the per-mode in-place reset (avoid full page reload).
 * Garde pour compatibilite si appele depuis un endroit non migre.
 */
export function nextQuestion() {
    window.location.reload();
}

/**
 * Reset l'UI commune entre deux questions, sans recharger la page.
 * - Vide l'input et le message
 * - Recache le titre du jeu (opacity 0)
 * - Restaure le bouton 'Indice' (texte + handler par defaut showHint)
 * - Cache le bouton 'Prochaine question'
 * - Vide #content
 * - Supprime les fleches de navigation
 * - Remet le timer a 00:00
 * Doit etre appelee par chaque mode dans son nextQuestion local avant
 * de relancer launchGameX(). Ne touche pas aux variables d'etat JS du
 * mode (cachedGame, hintNav, ...) -- c'est au mode de les reinitialiser.
 */
export function resetGameUI() {
    const input = document.getElementById('user-input');
    if (input) input.value = '';

    const message = document.getElementById('message');
    if (message) {
        message.innerText = '';
        message.style.color = '';
    }

    const gameTitle = document.getElementById('game-title');
    if (gameTitle) gameTitle.style.opacity = '0';

    const hintButton = document.getElementById('hint-button');
    if (hintButton) {
        hintButton.innerText = 'Indice';
        hintButton.onclick = () => {
            if (typeof window.showHint === 'function') window.showHint();
        };
    }

    const nextButton = document.getElementById('next-button');
    if (nextButton) nextButton.style.display = 'none';

    const content = document.getElementById('content');
    if (content) content.innerHTML = '';

    removeNavigationArrows();

    const timer = document.getElementById('timer');
    if (timer) timer.innerText = '00:00';
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
 * Show correct answer feedback.
 * En plus du message inline + next-button + titre revele, declenche une
 * modale celebrative qui rend le titre visible immediatement (sans scroll)
 * meme si l'utilisateur a fait defiler la page pour saisir sa reponse.
 * @param {string} gameTitle - The game title to reveal
 * @param {number} timerInterval - The timer interval to stop
 */
export function showCorrectAnswerFeedback(gameTitle, timerInterval) {
    document.getElementById('message').innerText = 'Bonne réponse !';
    document.getElementById('message').style.color = 'orange';
    document.getElementById('next-button').style.display = 'block';
    stopTimer(timerInterval);
    document.getElementById('game-title').style.opacity = '1';
    // Modale celebrative (auto-close 2.5s) -- contourne le header fixe
    // qui pouvait masquer le titre inline si l'utilisateur avait scrolle.
    revealTitle(gameTitle, {
        mode: 'modal',
        autoAdvance: true,
        delay: 2500,
        intro: 'Bravo !',
        accent: 'success',
    });
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

/**
 * Reveal the game title in a modal or inline before performing an action.
 * Le style neon est aligne avec tokens.css ; l'accent (couleur titre)
 * et le message d'intro sont parametrables pour distinguer victoire
 * (accent 'success') et abandon (accent 'default').
 * @param {string} title - The game title to reveal
 * @param {Object} options - Configuration options
 * @param {string} options.mode - Display mode: 'modal' or 'inline' (default: 'modal')
 * @param {boolean} options.autoAdvance - Auto-advance after delay (default: true)
 * @param {number} options.delay - Delay in ms before auto-advance (default: 2000)
 * @param {string} options.intro - Texte d'intro affiche au-dessus du titre (defaut: "La réponse était :")
 * @param {('default'|'success')} options.accent - 'success' = vert pour victoire, 'default' = orange/rose pour abandon
 * @returns {Promise} Resolves when the reveal finishes (user clicks OK or after delay)
 */
export function revealTitle(title, options = {}) {
    const {
        mode = 'modal',
        autoAdvance = true,
        delay = 2000,
        intro = 'La réponse était :',
        accent = 'default',
    } = options;
    const accentColor = accent === 'success' ? 'var(--neon-success, #39ff14)' : 'var(--neon-primary, #ffb86b)';
    const accentShadow = accent === 'success'
        ? '0 0 12px rgba(57, 255, 20, 0.6), 0 0 24px rgba(57, 255, 20, 0.3)'
        : '0 0 12px rgba(255, 184, 107, 0.6), 0 0 24px rgba(255, 107, 159, 0.3)';

    // S'assure que les keyframes gtg-dialog-fade-in / gtg-dialog-pop-in
    // sont presentes dans le DOM (elles vivent dans dialog.js).
    ensureDialogStyles();

    return new Promise((resolve) => {
        if (mode === 'modal') {
            // Create overlay (style aligne avec dialog.js neon)
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.inset = '0';
            overlay.style.background = 'rgba(8, 4, 15, 0.78)';
            overlay.style.backdropFilter = 'blur(6px)';
            overlay.style.webkitBackdropFilter = 'blur(6px)';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.zIndex = '9999';
            overlay.style.animation = 'gtg-dialog-fade-in 0.18s ease-out';

            // Create modal box
            const modalBox = document.createElement('div');
            modalBox.style.position = 'relative';
            modalBox.style.minWidth = '320px';
            modalBox.style.maxWidth = 'min(540px, 90vw)';
            modalBox.style.padding = 'clamp(1.5rem, 4vw, 2.25rem)';
            modalBox.style.background = 'rgba(20, 9, 30, 0.95)';
            modalBox.style.border = '1px solid rgba(255, 184, 107, 0.35)';
            modalBox.style.borderRadius = '14px';
            modalBox.style.boxShadow = '0 0 25px rgba(255, 184, 107, 0.18), 0 0 60px rgba(255, 107, 159, 0.1)';
            modalBox.style.color = '#e8e1f5';
            modalBox.style.textAlign = 'center';
            modalBox.style.fontFamily = "'Rajdhani', 'Poppins', sans-serif";
            modalBox.style.animation = 'gtg-dialog-pop-in 0.22s cubic-bezier(0.34, 1.5, 0.64, 1)';

            // Info line
            const infoLine = document.createElement('p');
            infoLine.innerText = intro;
            infoLine.style.fontFamily = "'Orbitron', 'Poppins', sans-serif";
            infoLine.style.fontWeight = '700';
            infoLine.style.fontSize = '0.9rem';
            infoLine.style.letterSpacing = '0.16em';
            infoLine.style.textTransform = 'uppercase';
            infoLine.style.color = '#00f6ff';
            infoLine.style.textShadow = '0 0 8px rgba(0, 246, 255, 0.5)';
            infoLine.style.margin = '0 0 0.75rem 0';

            // Title element
            const titleElement = document.createElement('h2');
            titleElement.innerText = title;
            titleElement.style.fontFamily = "'Orbitron', 'Poppins', sans-serif";
            titleElement.style.fontWeight = '900';
            titleElement.style.fontSize = 'clamp(1.4rem, 4vw, 2.1rem)';
            titleElement.style.letterSpacing = '0.06em';
            titleElement.style.textTransform = 'uppercase';
            titleElement.style.color = accentColor;
            titleElement.style.textShadow = accentShadow;
            titleElement.style.margin = '0 0 1.5rem 0';
            titleElement.style.wordBreak = 'break-word';

            // OK button
            const okButton = document.createElement('button');
            okButton.innerText = 'OK';
            okButton.style.padding = '0.6rem 1.6rem';
            okButton.style.fontFamily = "'Orbitron', 'Poppins', sans-serif";
            okButton.style.fontWeight = '700';
            okButton.style.fontSize = '0.85rem';
            okButton.style.letterSpacing = '0.08em';
            okButton.style.textTransform = 'uppercase';
            okButton.style.color = '#08040f';
            okButton.style.background = 'linear-gradient(135deg, #ffb86b, #ff6b9f)';
            okButton.style.border = 'none';
            okButton.style.borderRadius = '999px';
            okButton.style.cursor = 'pointer';
            okButton.style.boxShadow = '0 0 18px rgba(255, 184, 107, 0.4)';

            const cleanup = () => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                resolve();
            };

            okButton.onclick = cleanup;

            // Assemble modal
            modalBox.appendChild(infoLine);
            modalBox.appendChild(titleElement);
            modalBox.appendChild(okButton);
            overlay.appendChild(modalBox);
            document.body.appendChild(overlay);

            // Auto-advance after delay if enabled
            if (autoAdvance) {
                setTimeout(cleanup, delay);
            }
        } else {
            // Inline mode
            const gameTitleElement = document.getElementById('game-title');
            if (!gameTitleElement) {
                resolve();
                return;
            }
            gameTitleElement.innerText = title;
            gameTitleElement.style.opacity = '1';

            if (autoAdvance) {
                setTimeout(resolve, delay);
            } else {
                // Create Continue button under title
                const continueButton = document.createElement('button');
                continueButton.innerText = 'Continuer';
                continueButton.style.padding = '10px 30px';
                continueButton.style.fontSize = '1rem';
                continueButton.style.cursor = 'pointer';
                continueButton.style.backgroundColor = '#ff6600';
                continueButton.style.color = '#fff';
                continueButton.style.border = 'none';
                continueButton.style.borderRadius = '5px';
                continueButton.style.marginTop = '10px';
                continueButton.style.display = 'block';

                continueButton.onclick = () => {
                    if (continueButton.parentNode) {
                        continueButton.parentNode.removeChild(continueButton);
                    }
                    resolve();
                };

                if (gameTitleElement.parentNode) {
                    gameTitleElement.parentNode.insertBefore(continueButton, gameTitleElement.nextSibling);
                } else {
                    resolve();
                }
            }
        }
    });
}
