// Update Clock
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    document.getElementById('current-time').textContent = timeStr;
    document.getElementById('large-clock').textContent = timeStr;
    
    // Update Date
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateStr = now.toLocaleDateString('fr-FR', options);
    document.getElementById('current-date').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}

setInterval(updateClock, 1000);
updateClock();

// Lock Screen Logic
const lockScreen = document.getElementById('lock-screen');
const homeScreen = document.getElementById('home-screen');

lockScreen.addEventListener('click', () => {
    lockScreen.style.transform = 'translateY(-100%)';
    setTimeout(() => {
        lockScreen.classList.add('hidden');
        homeScreen.classList.remove('hidden');
    }, 600);
});

// App Management
function openApp(appId) {
    const appWindow = document.getElementById(`app-${appId}`);
    if (appWindow) {
        appWindow.classList.remove('hidden');
        expandDynamicIsland();
    }
}

function goHome() {
    const appWindows = document.querySelectorAll('.app-window');
    appWindows.forEach(win => win.classList.add('hidden'));
    
    if (homeScreen.classList.contains('hidden')) {
        homeScreen.classList.remove('hidden');
    }
    
    shrinkDynamicIsland();
}

// Dynamic Island Interactions
function expandDynamicIsland() {
    const island = document.getElementById('dynamic-island');
    island.classList.add('expanded');
    setTimeout(() => island.classList.remove('expanded'), 3000);
}

function shrinkDynamicIsland() {
    const island = document.getElementById('dynamic-island');
    island.classList.remove('expanded');
}

// Dark Mode Toggle
let isDarkMode = false;
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    const body = document.body;
    if (isDarkMode) {
        body.style.filter = 'brightness(0.8)';
    } else {
        body.style.filter = 'brightness(1)';
    }
}

// Swipe to unlock (optional enhancement)
let startY = 0;
lockScreen.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
});

lockScreen.addEventListener('touchend', (e) => {
    let endY = e.changedTouches[0].clientY;
    if (startY - endY > 100) {
        lockScreen.style.transform = 'translateY(-100%)';
        setTimeout(() => {
            lockScreen.classList.add('hidden');
            homeScreen.classList.remove('hidden');
        }, 600);
    }
});
