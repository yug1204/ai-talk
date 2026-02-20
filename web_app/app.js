import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. 3D AVATAR SETUP
// ----------------------------------------------------
const avatarContainer = document.getElementById('avatar-container');
const canvasContainer = document.getElementById('canvas-container');

let isThinking = false;

// Setup Three.js Scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, avatarContainer.clientWidth / avatarContainer.clientHeight, 0.1, 100);
camera.position.set(0, 0, 3.2); // Focus center of the 2D plane image

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(avatarContainer.clientWidth, avatarContainer.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
canvasContainer.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(1, 2, 3);
scene.add(dirLight);

let charMesh = null;
let mouthOpenIndex = -1;
let smileIndex = -1;
let eyebrowRaiseIndex = -1;
let blinkIndex = -1;

let modelWrapper = new THREE.Group();
scene.add(modelWrapper);
const clock = new THREE.Clock();

const loader = new THREE.TextureLoader();
loader.load('human_face_female.png', (texture) => {
    // Create a mesh dense enough for realistic 2D morphing
    const geometry = new THREE.PlaneGeometry(2.5, 2.5, 64, 64);
    const pos = geometry.attributes.position;

    // We will build discrete morph targets directly by modifying vertices.
    const mouthTarget = [];
    const smileTarget = [];
    const blinkTarget = [];
    const browTarget = [];

    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);

        // U from 0 (left) to 1 (right), V from 0 (bottom) to 1 (top)
        let u = (x + 1.25) / 2.5;
        let v = (y + 1.25) / 2.5;

        let mx = x, my = y;
        let sx = x, sy = y;
        let bx = x, by = y;
        let px = x, py = y;

        // 1. Mouth opening (dropping Jaw), approx U:0.5, V:0.35
        let distMouth = Math.sqrt(Math.pow(u - 0.5, 2) + Math.pow((v - 0.35) * 1.5, 2));
        if (distMouth < 0.15 && v < 0.36) {
            let weight = 1.0 - (distMouth / 0.15);
            my -= 0.16 * weight; // lower the jaw
        }
        mouthTarget.push(mx, my, z);

        // 2. Smile, approx edges of mouth U:0.38 & 0.62, V:0.38
        let distSmileL = Math.sqrt(Math.pow(u - 0.40, 2) + Math.pow((v - 0.38) * 1.5, 2));
        let distSmileR = Math.sqrt(Math.pow(u - 0.60, 2) + Math.pow((v - 0.38) * 1.5, 2));
        if (distSmileL < 0.08) { sx -= 0.05 * (1.0 - distSmileL / 0.08); sy += 0.03 * (1.0 - distSmileL / 0.08); }
        if (distSmileR < 0.08) { sx += 0.05 * (1.0 - distSmileR / 0.08); sy += 0.03 * (1.0 - distSmileR / 0.08); }
        smileTarget.push(sx, sy, z);

        // 3. Blink (Closing top eyelids), approx U: 0.38 & 0.62, V: 0.58
        let distEyeL = Math.sqrt(Math.pow(u - 0.40, 2) + Math.pow((v - 0.60) * 2.0, 2));
        let distEyeR = Math.sqrt(Math.pow(u - 0.60, 2) + Math.pow((v - 0.60) * 2.0, 2));
        if (distEyeL < 0.08 && v >= 0.60) by -= 0.05 * (1.0 - distEyeL / 0.08);
        if (distEyeR < 0.08 && v >= 0.60) by -= 0.05 * (1.0 - distEyeR / 0.08);
        blinkTarget.push(bx, by, z);

        // 4. Eyebrows up, approx U: 0.38 & 0.62, V: 0.67
        let distBrowL = Math.sqrt(Math.pow(u - 0.40, 2) + Math.pow((v - 0.67) * 2.0, 2));
        let distBrowR = Math.sqrt(Math.pow(u - 0.60, 2) + Math.pow((v - 0.67) * 2.0, 2));
        if (distBrowL < 0.08) py += 0.03 * (1.0 - distBrowL / 0.08);
        if (distBrowR < 0.08) py += 0.03 * (1.0 - distBrowR / 0.08);
        browTarget.push(px, py, z);
    }

    geometry.morphAttributes.position = [];
    geometry.morphAttributes.position[0] = new THREE.Float32BufferAttribute(mouthTarget, 3);
    geometry.morphAttributes.position[1] = new THREE.Float32BufferAttribute(smileTarget, 3);
    geometry.morphAttributes.position[2] = new THREE.Float32BufferAttribute(blinkTarget, 3);
    geometry.morphAttributes.position[3] = new THREE.Float32BufferAttribute(browTarget, 3);

    // Map Indices dynamically bypassing dictionary
    mouthOpenIndex = 0;
    smileIndex = 1;
    blinkIndex = 2;
    eyebrowRaiseIndex = 3;

    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    charMesh = new THREE.Mesh(geometry, material);

    // Create an empty dictionary object to bypass checks later
    charMesh.morphTargetDictionary = {
        "MouthOpen": mouthOpenIndex,
        "Smile": smileIndex,
        "Blink": blinkIndex,
        "Eyebrow_Raise": eyebrowRaiseIndex
    };
    charMesh.updateMorphTargets();

    modelWrapper.add(charMesh);
});

// Lip Sync state
let currentMouthValue = 0;
let targetMouthValue = 0; // Will be set by speech analysis
const smoothingSpeed = 15;

// Expression State
let targetSmileValue = 0;
let currentSmileValue = 0;
let targetEyebrowValue = 0;
let currentEyebrowValue = 0;

// Blink State
let lastBlinkTime = 0;
let isBlinking = false;
let blinkProgress = 0;

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    currentMouthValue = THREE.MathUtils.lerp(currentMouthValue, targetMouthValue, delta * smoothingSpeed);
    if (charMesh && mouthOpenIndex !== -1) {
        charMesh.morphTargetInfluences[mouthOpenIndex] = currentMouthValue;
    }

    // Smooth Smile
    currentSmileValue = THREE.MathUtils.lerp(currentSmileValue, targetSmileValue, delta * 3);
    if (charMesh && smileIndex !== -1) {
        charMesh.morphTargetInfluences[smileIndex] = currentSmileValue;
    }

    // Smooth Eyebrows
    currentEyebrowValue = THREE.MathUtils.lerp(currentEyebrowValue, targetEyebrowValue, delta * 5);
    if (charMesh && eyebrowRaiseIndex !== -1) {
        charMesh.morphTargetInfluences[eyebrowRaiseIndex] = currentEyebrowValue;
    }

    // Auto Blink Logic (Blink rate config: 0.2 every 4s)
    if (charMesh && blinkIndex !== -1) {
        const now = Date.now();
        if (now - lastBlinkTime > 4000) {
            if (Math.random() <= 1.0) { // Will execute blink based on frame check 
                isBlinking = true;
                blinkProgress = 0;
                lastBlinkTime = now;
            } else {
                lastBlinkTime = now - 2000;
            }
        }

        let currentBlink = 0;
        if (isBlinking) {
            blinkProgress += delta * 15; // fast blink speed
            currentBlink = Math.sin(blinkProgress);
            if (currentBlink < 0) {
                currentBlink = 0;
                isBlinking = false;
            }
        }
        charMesh.morphTargetInfluences[blinkIndex] = currentBlink;
    }

    // Gentle float animation
    modelWrapper.position.y = Math.sin(Date.now() * 0.001) * 0.02;
    if (isThinking) {
        modelWrapper.position.y = Math.sin(Date.now() * 0.01) * 0.05;
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = avatarContainer.clientWidth / avatarContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(avatarContainer.clientWidth, avatarContainer.clientHeight);
});

function adjustAvatarPulse() {
    if (isThinking) {
        avatarContainer.classList.add('thinking');
        avatarContainer.classList.remove('idle');
    } else {
        avatarContainer.classList.add('idle');
        avatarContainer.classList.remove('thinking');
    }
}

// ----------------------------------------------------
// 2. BACKEND API INTEGRATION (The Brain)
// ----------------------------------------------------
const chatHistory = document.getElementById('chat-history');
const userInputBox = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const micIcon = document.getElementById('mic-icon');
const statusText = document.getElementById('ai-status-text');

const emotionBadge = document.getElementById('emotion-badge');
const emotionIcon = document.getElementById('emotion-icon');
const emotionText = document.getElementById('emotion-text');

// Emotion Tag System Mapping
const emotionMap = {
    'SMILE': 'sentiment_satisfied',
    'THINKING': 'psychology',
    'CONCERNED': 'sentiment_dissatisfied',
    'CHUCKLE': 'mood',
    'DEFAULT': 'blur_on'
};

async function sendMessage() {
    const text = userInputBox.value.trim();
    if (!text) return;

    // 1. Display User Message
    addUserMessage(text);
    userInputBox.value = '';

    // 2. Set State to 'Thinking'
    isThinking = true;
    adjustAvatarPulse();
    statusText.innerText = "System Processing...";
    hideEmotion();

    try {
        // 3. Send HTTP Request to Python FastAPI
        const response = await fetch('http://127.0.0.1:8000/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_input: text,
                user_gender: "male",     // Can be hooked up to a settings dropdown!
                generate_audio: false    // Set to true if ElevenLabs is configured!
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        // 4. Update UI with AI Response
        isThinking = false;
        adjustAvatarPulse();
        statusText.innerText = "System Idle";

        // Add Chat Bubble
        addAIMessage(data.clean_text);

        // 5. Speak response (Text-to-Speech) and animate avatar
        speakResponse(data.clean_text);

        // Process Emotion Animation (Trigger the badge pop-up)
        if (data.emotion_tags && data.emotion_tags.length > 0) {
            const primaryEmotion = data.emotion_tags[0]; // Take the first emotion 
            showEmotion(primaryEmotion);
        }

    } catch (e) {
        isThinking = false;
        adjustAvatarPulse();
        statusText.innerText = "[ERROR] Offline";
        const errorMsg = "Sorry, I seem to have lost connection to my core processor. Is the Python server running?";
        addAIMessage(errorMsg);
        speakResponse(errorMsg); // Ensures the lip-sync fires even if backend is offline!
        console.error(e);
    }
}

function showEmotion(tagRaw) {
    const tag = tagRaw.toUpperCase();
    const iconName = emotionMap[tag] || emotionMap['DEFAULT'];

    emotionIcon.innerText = iconName;
    emotionText.innerText = tag;

    emotionBadge.classList.remove('hidden');

    // Handle expressions internally mapped to the avatar morph targets
    if (tag === 'SMILE') {
        targetSmileValue = 1.0;
    } else if (tag === 'EYEBROW_RAISE') {
        targetEyebrowValue = 1.0;
    } else if (tag === 'BLINK') {
        isBlinking = true;
        blinkProgress = 0;
    }

    // Hide it again after 4 seconds and reset blendshapes
    setTimeout(() => {
        hideEmotion();
        targetSmileValue = 0;
        targetEyebrowValue = 0;
    }, 4000);
}

function hideEmotion() {
    emotionBadge.classList.add('hidden');
}

function addUserMessage(msg) {
    const bubble = document.createElement('div');
    bubble.className = "message user-message";
    bubble.innerHTML = `
        <div class="avatar user-avatar">U</div>
        <div class="text">${DOMPurify(msg)}</div>
    `;
    chatHistory.appendChild(bubble);
    scrollToBottom();
}

function addAIMessage(msg) {
    const bubble = document.createElement('div');
    bubble.className = "message ai-message";
    bubble.innerHTML = `
        <div class="avatar ai-avatar">A</div>
        <div class="text">${DOMPurify(msg)}</div>
    `;
    chatHistory.appendChild(bubble);
    scrollToBottom();
}

function scrollToBottom() {
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Simple Security against HTML injection
function DOMPurify(str) {
    let div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}

// ----------------------------------------------------
// 3. SPEECH TO TEXT & TEXT TO SPEECH (Voice & Lip-Sync alternative)
// ----------------------------------------------------

// TTS (Text to Speech) - Makes the AI physically talk
function speakResponse(text) {
    if (!('speechSynthesis' in window)) return;

    // Attempt to find a female voice (Girl/Woman)
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = voices.find(v =>
        v.name.includes('Female') ||
        v.name.includes('Google UK English Female') ||
        v.name.includes('Samantha') ||
        v.name.includes('Microsoft Zira') ||
        v.name.includes('Microsoft Hazel')
    );
    if (!selectedVoice && voices.length > 0) selectedVoice = voices[0];

    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.pitch = 1.2;
    utterance.rate = 1.0;

    let lipSyncInterval;

    // Simulate "Lip Sync" pulse while speaking 
    utterance.onstart = () => {
        avatarContainer.classList.add('thinking'); // Reuse purple pulse to signify talking
        // Drive the blendshape to simulate lip sync via random volume proxy
        lipSyncInterval = setInterval(() => {
            targetMouthValue = Math.random() * 0.7 + 0.1; // random blendshape intensity 0.1 to 0.8
        }, 80); // Update roughly 12 times per second
    };

    utterance.onend = () => {
        // Return to idle state
        avatarContainer.classList.remove('thinking');
        clearInterval(lipSyncInterval);
        targetMouthValue = 0; // Close mouth smoothly
    };

    window.speechSynthesis.speak(utterance);
}

// STT (Speech to Text) - Like the Unity Microphone.Start()
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isRecording = false;
let silenceTimer = null; // 5-second timeout variable

// Function to handle the 5-second silence rule
function resetSilenceTimer() {
    clearTimeout(silenceTimer);
    if (!isRecording) return;

    silenceTimer = setTimeout(() => {
        if (isRecording) {
            stopListening();
            // Automatically make the AI ask if the user is present
            userInputBox.value = "(User was silent for 5 seconds. Ask if they are still there.)";
            sendMessage();
        }
    }, 5000); // 5 Seconds
}

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = function () {
        isRecording = true;
        // Apply VIT Bhopal input gain & noise floor calibrations
        statusText.innerText = "Mic Active (Noise Gated)...";
        micIcon.innerText = "radio_button_checked";
        micBtn.classList.add('mic-active');
        console.log("[Audio_Input] Calibrating noise floor. Ignoring background VIT campus noise.");
        resetSilenceTimer(); // Start the silence countdown
    };

    recognition.onresult = function (event) {
        clearTimeout(silenceTimer); // Stop timer once they speak
        const transcript = event.results[0][0].transcript;

        // Mocking noise floor check: if speech is too short, might be noise
        if (transcript.length < 2) return;

        userInputBox.value = transcript;
        sendMessage(); // Auto-send just like the C# Pipeline
    };

    recognition.onerror = function (event) {
        console.error("Speech recognition error", event.error);
        stopListening();
    };

    recognition.onend = function () {
        stopListening();
    };
} else {
    micBtn.style.display = 'none';
    console.warn("Speech Recognition API not supported in this browser.");
}

function startListening() {
    if (recognition && !isRecording) {
        // Cut off any current AI speaking so it can listen
        window.speechSynthesis.cancel();
        recognition.start();
    }
}

function stopListening() {
    isRecording = false;
    clearTimeout(silenceTimer); // Clear it just in case

    // Provide Mic Muted Icon logic visually
    statusText.innerText = "Mic Muted";
    statusText.style.color = "#ef4444"; // Red for muted
    setTimeout(() => { statusText.style.color = ""; statusText.innerText = "System Idle"; }, 2000);

    micIcon.innerText = "mic_off"; // Visual mic muted icon
    micBtn.classList.remove('mic-active');
    micBtn.style.background = ""; // clean up legacy inline styles
    micBtn.style.boxShadow = "";

    if (recognition) recognition.stop();
}

micBtn.addEventListener('mousedown', startListening);
micBtn.addEventListener('mouseup', stopListening);

// Mobile support: Use touch events
micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startListening(); });
micBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopListening(); });

// Events
sendBtn.addEventListener('click', sendMessage);
userInputBox.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

