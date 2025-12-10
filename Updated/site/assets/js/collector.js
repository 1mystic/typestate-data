// --- Data ---
const TEXTS = {
    relaxed: [
        "The sunlight filtered through the leaves, painting the forest floor in dappled shades of gold and green. A gentle breeze whispered through the branches, carrying the scent of pine and damp earth. Somewhere in the distance, a stream bubbled over smooth stones, its rhythm steady and calming. There was no rush here, only the slow, deliberate pulse of nature.",
        "Clouds drifted lazily across the azure sky, their shapes shifting and morphing in slow motion. The ocean below mirrored the vastness above, waves rolling in with a soothing rhythm that had continued for millennia. Sand warmed by the afternoon sun felt soft underfoot, grounding the moment in pure, unhurried existence."
    ],
    stressed: [
        "The patient presents with acute myocardial infarction symptoms, including substernal chest pain radiating to the left arm, diaphoresis, and dyspnea. Immediate intervention requires the administration of aspirin, nitroglycerin, and morphine, followed by rapid transport to the catheterization lab for percutaneous coronary intervention. Time is critical to prevent irreversible necrosis.",
        "System failure imminent. Error code 0x84F3 indicates a critical memory overflow in the central processing unit. Reboot sequence initiated but failed due to corrupted kernel dependencies. Please manually override the failsafe protocol by entering the hexadecimal key sequence immediately or risk total data loss. 10 seconds remaining."
    ]
};

// --- State ---
let state = {
    mode: 'relaxed', // 'relaxed' | 'stressed'
    startTime: null,
    isActive: false,
    words: [],
    currentWordIndex: 0,
    currentCharIndex: 0,
    keystrokes: [], // { key, type, time }
    sessionId: null,
    timer: null,
    stressWatchdog: null,
    lastActivity: 0,
    totalCharsTyped: 0,
    correctCharsTyped: 0,
    analysisTimer: null // AI Loop Timer
};

// --- Sound Engine ---
const SoundEngine = {
    ctx: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    play() {
        if (!this.ctx) this.init();
        const t = this.ctx.currentTime;

        // Noise buffer for "click" texture
        const bufferSize = this.ctx.sampleRate * 0.01; // 10ms noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Noise envelope
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.01);

        noise.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(t);

        // Oscillator for "thock" body
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.05);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.3, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.05);
    }
};

let buffer = []; // Stores local sessions

// --- Elements ---
const els = {
    words: document.getElementById('words'),
    caret: document.getElementById('caret'),
    wpm: document.getElementById('wpm'),
    acc: document.getElementById('acc'),
    overlay: document.getElementById('overlay'),
    btnRelaxed: document.getElementById('btn-relaxed'),
    btnStressed: document.getElementById('btn-stressed'),
    body: document.body,
    datasetCount: document.getElementById('dataset-count'),
    timerDisplay: document.getElementById('timer-display'),
    countdown: document.getElementById('countdown'),
    typingContainer: document.getElementById('typing-container'),
    modeHint: document.getElementById('mode-hint'),
    mobileInput: document.getElementById('hidden-input')
};

// --- Initialization ---
async function init() {
    // Wait for fonts to ensure layout/cursor is correct
    document.fonts.ready.then(() => {
        console.log('Fonts loaded');
        updateCaretPosition();
    });

    // Initialize Audio Context on first interaction
    const enableAudio = () => {
        SoundEngine.init();
        document.removeEventListener('click', enableAudio);
        document.removeEventListener('keydown', enableAudio);
    };
    document.addEventListener('click', enableAudio);
    document.addEventListener('keydown', enableAudio);

    setMode('relaxed');
    // Removed duplicate setMode
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Mobile Support
    if (els.mobileInput) {
        els.mobileInput.addEventListener('input', handleMobileInput);
        // Force focus on click (Aggressive)
        const focusInput = () => {
            if (state.isActive || els.overlay.style.opacity !== '0') {
                els.mobileInput.focus();
                els.mobileInput.click(); // Some devices need a simulated click
            }
        };

        document.addEventListener('click', focusInput);
        document.addEventListener('touchstart', focusInput); // Catch touches too

        // Attempt immediate focus (Best Effort)
        els.mobileInput.focus();
    }

    window.addEventListener('resize', () => { }); // Noop

    // Check DB Status
    checkDBConnection();
}

function checkDBConnection() {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return; // HUD might be missing in some versions

    if (window.db) {
        dot.style.backgroundColor = '#10b981'; // Green
        text.innerText = "Cloud Active";
    } else {
        dot.style.backgroundColor = '#ef4444'; // Red
        text.innerText = "Offline Mode";
        // Retry once after 2s (in case of slow load)
        setTimeout(() => {
            if (window.db) {
                dot.style.backgroundColor = '#10b981';
                text.innerText = "Cloud Active";
            }
        }, 2000);
    }
}

function setMode(mode) {
    state.mode = mode;
    els.body.setAttribute('data-theme', mode);

    // UI Toggle
    if (mode === 'relaxed') {
        els.btnRelaxed.classList.add('active');
        els.btnStressed.classList.remove('active');
        els.timerDisplay.classList.remove('flex'); // Was 'hidden' but flex handles d-none
        els.timerDisplay.style.display = 'none';

        els.modeHint.innerText = "Mode: Relaxed (Natural pace, no pressure)";
    } else {
        els.btnStressed.classList.add('active');
        els.btnRelaxed.classList.remove('active');
        els.timerDisplay.style.display = 'flex';
        els.modeHint.innerText = "Mode: Stressed (Timer active, keep typing!)";
    }

    resetGame();
}

function resetGame() {
    stopLiveAnalysis();
    state.isActive = false;
    state.startTime = null;
    state.currentWordIndex = 0;
    state.currentCharIndex = 0;
    state.keystrokes = [];
    state.totalCharsTyped = 0;
    state.correctCharsTyped = 0;
    state.sessionId = crypto.randomUUID(); // Better UUID
    els.overlay.style.opacity = '1';
    els.overlay.style.pointerEvents = 'auto'; // Enable clicks on overlay (if any)


    // Select random text
    const textPool = TEXTS[state.mode];
    const text = textPool[Math.floor(Math.random() * textPool.length)];

    // Render Words
    state.words = text.split(' ');
    els.words.innerHTML = state.words.map(word => {
        return `<div class="word">${word.split('').map(char => `<span class="letter">${char}</span>`).join('')}</div>`;
    }).join('');

    // Reset UI
    const letters = document.querySelectorAll('.letter');
    if (letters.length > 0) letters[0].classList.add('active');
    updateActiveLetter();

    clearInterval(state.timer);
    clearInterval(state.stressWatchdog);
}

function startGame() {
    state.isActive = true;
    state.startTime = Date.now();
    state.lastActivity = Date.now();
    els.overlay.style.opacity = '0';
    els.overlay.style.opacity = '0';
    els.overlay.style.pointerEvents = 'none'; // Passthrough clicks to game/button
    if (els.mobileInput) els.mobileInput.focus();


    if (state.mode === 'stressed') {
        startStressMechanics();
    }

    // Start AI Loop
    startLiveAnalysis();
}

function startStressMechanics() {
    let timeLeft = 60;
    els.countdown.innerText = timeLeft;

    // Countdown Timer
    state.timer = setInterval(() => {
        timeLeft--;
        els.countdown.innerText = timeLeft;
        if (timeLeft <= 0) finishSession();
    }, 1000);

    // Idle Watchdog (The Stressor)
    state.stressWatchdog = setInterval(() => {
        const idleTime = Date.now() - state.lastActivity;
        if (idleTime > 2000 && state.isActive) {
            // Visual Punishment
            els.body.classList.add('shake-screen');
            els.body.style.backgroundColor = '#ffebee'; // Flash red
            setTimeout(() => {
                els.body.classList.remove('shake-screen');
                els.body.style.backgroundColor = '';
            }, 500);
        }
    }, 500);
}

// --- AI Intervention Logic ---
function startLiveAnalysis() {
    if (state.analysisTimer) clearInterval(state.analysisTimer);

    console.log("Starting AI Loop...");

    state.analysisTimer = setInterval(async () => {
        if (!state.isActive) return;

        // Payload
        const payload = {
            keystrokes: state.keystrokes
        };

        try {
            const res = await fetch('http://localhost:8000/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                console.log("AI says:", data);

                if (data.status === 'stressed' && data.score > 0.6) {
                    triggerCalmingIntervention(data.score);
                } else {
                    removeIntervention();
                }
            }
        } catch (err) {
            console.error("AI Server Error:", err);
        }

    }, 2000); // Every 2 seconds
}

function stopLiveAnalysis() {
    if (state.analysisTimer) {
        clearInterval(state.analysisTimer);
        state.analysisTimer = null;
    }
    removeIntervention();
}

function triggerCalmingIntervention(score) {
    // "Screen turns soft green and says High Cognitive Load Detected"
    document.body.style.transition = "background-color 1s ease";
    document.body.style.backgroundColor = "#e8f5e9"; // Soft Green

    let msg = document.getElementById('ai-msg');
    if (!msg) {
        msg = document.createElement('div');
        msg.id = 'ai-msg';
        msg.style.position = 'fixed';
        msg.style.top = '20px';
        msg.style.left = '50%';
        msg.style.transform = 'translateX(-50%)';
        msg.style.padding = '1rem 2rem';
        msg.style.backgroundColor = '#4caf50';
        msg.style.color = 'white';
        msg.style.borderRadius = '50px';
        msg.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        msg.style.fontWeight = 'bold';
        msg.style.zIndex = '1000';
        msg.innerHTML = `<span class="material-icons-round" style="vertical-align: middle; margin-right:8px">self_improvement</span> High Cognitive Load Detected`;
        document.body.appendChild(msg);
    }
    msg.style.display = 'block';
}

function removeIntervention() {
    document.body.style.backgroundColor = ''; // Reset
    const msg = document.getElementById('ai-msg');
    if (msg) msg.style.display = 'none';
}

function handleKeyDown(e) {
    // Ignore modifiers alone
    if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return;

    // Start on first key
    if (!state.isActive) {
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) startGame();
        else return;
    }

    // Log Event
    state.keystrokes.push({
        type: 'down',
        key: e.code,
        char: e.key,
        time: Date.now()
    });

    // Play Sound
    SoundEngine.play();

    state.lastActivity = Date.now();

    const currentWordEl = els.words.children[state.currentWordIndex];
    if (!currentWordEl) return; // Safety

    // Backspace Logic
    if (e.key === 'Backspace') {
        if (state.currentCharIndex === 0 && state.currentWordIndex > 0) {
            state.currentWordIndex--;
            const prevWordEl = els.words.children[state.currentWordIndex];
            state.currentCharIndex = prevWordEl.children.length;
        } else if (state.currentCharIndex > 0) {
            state.currentCharIndex--;
            const charToReset = currentWordEl.children[state.currentCharIndex];
            if (charToReset) charToReset.className = 'letter';
        }
        updateActiveLetter();
        e.preventDefault(); // Prevent input event
        return;
    }

    // Typical Typing
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        const targetChar = state.words[state.currentWordIndex][state.currentCharIndex];
        const currentLetterEl = currentWordEl.children[state.currentCharIndex];

        if (targetChar && currentLetterEl) {
            if (e.key === targetChar) {
                currentLetterEl.classList.add('correct');
                state.correctCharsTyped++;
            } else {
                currentLetterEl.classList.add('incorrect');
            }
            state.totalCharsTyped++;
            state.currentCharIndex++;
        }

        // Word Complete detection is partly implicitly handled by spacebar, 
        // but we can visually show we are at end.
        e.preventDefault(); // Prevent input event
    }

    // Spacebar Logic
    if (e.code === 'Space') {
        e.preventDefault();

        // Count space as a character for WPM
        state.totalCharsTyped++;
        // Assuming space is correct if we are allowing move (simple logic)
        state.correctCharsTyped++;

        // Move to next word
        if (state.currentWordIndex < state.words.length - 1) {
            state.currentWordIndex++;
            state.currentCharIndex = 0;
        } else {
            finishSession();
        }
    }

    updateActiveLetter();
    updateStats();
}

function handleKeyUp(e) {
    if (!state.isActive) return;
    state.keystrokes.push({
        type: 'up',
        key: e.code,
        time: Date.now()
    });
}

function handleMobileInput(e) {
    // Map InputEvent to KeyDown for game logic
    if (e.inputType === 'insertText' && e.data) {
        for (let char of e.data) {
            handleKeyDown({
                key: char,
                code: char === ' ' ? 'Space' : 'MobileInput',
                ctrlKey: false,
                metaKey: false,
                preventDefault: () => { }
            });
        }
    } else if (e.inputType === 'deleteContentBackward') {
        handleKeyDown({
            key: 'Backspace',
            code: 'Backspace',
            ctrlKey: false,
            metaKey: false,
            preventDefault: () => { }
        });
    }

    // Always clear input to keep it ready for next tap
    e.target.value = '';
}

function updateActiveLetter() {
    // Remove active from all
    document.querySelectorAll('.letter.active').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.word.active-word').forEach(el => el.classList.remove('active-word'));

    const wordEl = els.words.children[state.currentWordIndex];
    if (!wordEl) return;

    wordEl.classList.add('active-word'); // Mark word

    let letterEl = wordEl.children[state.currentCharIndex];

    if (letterEl) {
        letterEl.classList.add('active');
    } else {
        // End of word - show cursor at the end
        if (wordEl.children.length > 0) {
            // We can add a 'right' cursor to the last letter
            wordEl.lastElementChild.setAttribute('data-cursor', 'right');
            wordEl.lastElementChild.classList.add('active');
        }
    }
    updateCaretPosition();
}

function updateCaretPosition() {
    // Placeholder to prevent ReferenceError since caret element isn't in HTML yet
    if (els.caret && els.caret.style) {
        // implementation if caret existed
    }
}

function updateStats() {
    const durationSec = (Date.now() - state.startTime) / 1000;
    if (durationSec <= 0) return;

    // Gross WPM: (All typed entries / 5) / Time in minutes
    // Standard Word = 5 characters
    const wpm = Math.round((state.totalCharsTyped / 5) / (durationSec / 60));

    // Accuracy: (Correct / Total) * 100
    let acc = 100;
    if (state.totalCharsTyped > 0) {
        acc = Math.round((state.correctCharsTyped / state.totalCharsTyped) * 100);
    }

    els.wpm.innerText = wpm;
    els.acc.innerText = acc;
}

function finishSession(manuallyTriggered = false) {
    if (!state.isActive && !manuallyTriggered) return; // Prevent double save

    state.isActive = false;
    clearInterval(state.timer);
    clearInterval(state.stressWatchdog);
    stopLiveAnalysis();

    // Data Object
    const sessionData = {
        sessionId: state.sessionId,
        mode: state.mode,
        startTime: state.startTime,
        endTime: Date.now(),
        text: state.words.join(' '),
        keystrokes: state.keystrokes,
        userAgent: navigator.userAgent,
        keystrokes: state.keystrokes,
        userAgent: navigator.userAgent,
        wpm: parseInt(els.wpm.innerText) || 0,
        accuracy: parseInt(els.acc.innerText) || 100
    };

    buffer.push(sessionData);
    els.datasetCount.innerText = `${buffer.length} Sessions`;

    // Sync to Cloud
    if (typeof saveSessionToCloud === 'function') {
        saveSessionToCloud(sessionData);
        console.log("Saving session...", sessionData);
    } else {
        alert("DB module not loaded. Data saved locally only.");
    }

    // Visual Feedback
    els.overlay.style.opacity = '1';
    els.overlay.style.pointerEvents = 'auto';
    els.modeHint.innerText = "Session Complete. Saving data...";

    setTimeout(() => {
        resetGame();
        els.modeHint.innerText = `Ready for next session (${state.mode === 'relaxed' ? 'Relaxed' : 'Stressed'})`;
    }, 2500);
}

function exportData() {
    if (buffer.length === 0) {
        alert("No sessions recorded locally yet!");
        return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(buffer, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "keystroke_backup_" + Date.now() + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Start
init();
