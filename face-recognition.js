// Global variables
let video = null;
let canvas = null;
let modelsLoaded = false;
let currentStream = null;
let currentFaceDescriptor = null;
let currentLocation = null;
let currentEmployee = null;

// Load face-api models
async function loadModels() {
    const MODEL_URL = './models';
    
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        
        modelsLoaded = true;
        updateStatus('modelStatus', '✅ AI Model ໂຫຼດສຳເລັດ', 'success');
        return true;
    } catch (error) {
        console.error('Error loading models:', error);
        updateStatus('modelStatus', '❌ ໂຫຼດ AI Model ບໍ່ສຳເລັດ, ກວດສອບໂຟນເດີ models/', 'error');
        return false;
    }
}

// Get GPS location
async function getLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Browser ບໍ່ຮອງຮັບ GPS'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                updateStatus('gpsStatus', '📍 ໄດ້ຕຳແໜ່ງ GPS ສຳເລັດ', 'success');
                resolve(currentLocation);
            },
            (error) => {
                let errorMsg = '';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = 'ກະລຸນາອນຸຍາດ GPS';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = 'ບໍ່ສາມາດຫາຕຳແໜ່ງໄດ້';
                        break;
                    default:
                        errorMsg = error.message;
                }
                updateStatus('gpsStatus', `❌ ${errorMsg}`, 'error');
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

// Check if within allowed location
function isWithinAllowedLocation(location) {
    if (!CONFIG.ALLOWED_LOCATION) return true;
    
    const R = 6371000; // Earth's radius in meters
    const lat1 = location.lat * Math.PI / 180;
    const lat2 = CONFIG.ALLOWED_LOCATION.lat * Math.PI / 180;
    const deltaLat = (CONFIG.ALLOWED_LOCATION.lat - location.lat) * Math.PI / 180;
    const deltaLng = (CONFIG.ALLOWED_LOCATION.lng - location.lng) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    const isWithin = distance <= CONFIG.ALLOWED_LOCATION.radius;
    
    const statusEl = document.getElementById('locationStatus');
    if (statusEl) {
        if (isWithin) {
            statusEl.innerHTML = `📍 ຢູ່ໃນໂຊນທີ່ກຳນົດ (${Math.round(distance)}/${CONFIG.ALLOWED_LOCATION.radius} ແມັດ) ✅`;
            statusEl.style.color = '#4CAF50';
        } else {
            statusEl.innerHTML = `📍 ຢູ່ນອກໂຊນທີ່ກຳນົດ (${Math.round(distance)}/${CONFIG.ALLOWED_LOCATION.radius} ແມັດ) ❌`;
            statusEl.style.color = '#f44336';
        }
    }
    
    return isWithin;
}

// Start camera
async function startCamera() {
    const videoElement = document.getElementById('video');
    if (!videoElement) return;
    
    try {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        currentStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' } 
        });
        videoElement.srcObject = currentStream;
        
        updateStatus('cameraStatus', '📷 ກ້ອງພ້ອມໃຊ້ງານ', 'success');
        
        // Start face detection loop
        detectFace();
        
        return true;
    } catch (error) {
        updateStatus('cameraStatus', '❌ ເປີດກ້ອງບໍ່ສຳເລັດ: ' + error.message, 'error');
        return false;
    }
}

// Detect face and get descriptor
async function detectFace() {
    const videoElement = document.getElementById('video');
    const canvasElement = document.getElementById('overlay');
    
    if (!videoElement || !canvasElement || !modelsLoaded) return;
    
    if (videoElement.videoWidth === 0) {
        setTimeout(detectFace, 100);
        return;
    }
    
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    
    const ctx = canvasElement.getContext('2d');
    
    setInterval(async () => {
        if (!videoElement.srcObject || videoElement.paused) return;
        
        const detection = await faceapi.detectSingleFace(
            videoElement, 
            new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceDescriptor();
        
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        if (detection) {
            currentFaceDescriptor = Array.from(detection.descriptor);
            
            // Draw bounding box
            const box = detection.detection.box;
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            
            // Draw landmarks
            detection.landmarks.positions.forEach(point => {
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(point.x - 1, point.y - 1, 2, 2);
            });
            
            // Try to match with employees
            await matchFace();
        } else {
            currentFaceDescriptor = null;
            const matchEl = document.getElementById('faceMatchResult');
            if (matchEl) {
                matchEl.innerHTML = '😕 ບໍ່ພົບໃບໜ້າ';
                matchEl.style.color = '#ff9800';
            }
        }
    }, 500);
}

// Match face with registered employees
async function matchFace() {
    if (!currentFaceDescriptor) return;
    
    try {
        const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=getEmployees`);
        const employees = await response.json();
        
        let bestMatch = null;
        let bestDistance = 0.6; // Threshold for face recognition
        
        for (const emp of employees) {
            if (!emp.descriptor) continue;
            
            const storedDescriptor = emp.descriptor;
            const distance = faceapi.euclideanDistance(currentFaceDescriptor, storedDescriptor);
            
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = emp;
            }
        }
        
        const matchEl = document.getElementById('faceMatchResult');
        if (bestMatch) {
            currentEmployee = bestMatch;
            matchEl.innerHTML = `✅ ຈຳໜ້າໄດ້: ${bestMatch.name} (${bestMatch.id})<br>🎯 ຄວາມແນ່ນອນ: ${Math.round((1 - bestDistance) * 100)}%`;
            matchEl.style.color = '#4CAF50';
            
            // Enable attendance buttons
            document.getElementById('checkinBtn').disabled = false;
            document.getElementById('checkoutBtn').disabled = false;
        } else {
            currentEmployee = null;
            matchEl.innerHTML = '❌ ບໍ່ຮູ້ຈັກໃບໜ້ານີ້';
            matchEl.style.color = '#f44336';
            document.getElementById('checkinBtn').disabled = true;
            document.getElementById('checkoutBtn').disabled = true;
        }
    } catch (error) {
        console.error('Error matching face:', error);
    }
}

// Record attendance
async function recordAttendance(type) {
    if (!currentEmployee) {
        showMessage('❌ ກະລຸນາຖ່າຍໃບໜ້າກ່ອນ', 'error');
        return;
    }
    
    try {
        await getLocation();
        
        if (!isWithinAllowedLocation(currentLocation)) {
            showMessage(`❌ ທ່ານຢູ່ນອກໂຊນທີ່ກຳນົດ, ບໍ່ສາມາດ${type === 'checkin' ? 'ເຂົ້າວຽກ' : 'ອອກວຽກ'}ໄດ້`, 'error');
            return;
        }
        
        const data = {
            action: type,
            employeeId: currentEmployee.id,
            employeeName: currentEmployee.name,
            location: currentLocation,
            timestamp: new Date().toISOString()
        };
        
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        showMessage(`✅ ${type === 'checkin' ? 'ເຂົ້າວຽກ' : 'ອອກວຽກ'}ສຳເລັດ`, 'success');
        
        // Disable buttons temporarily to prevent double click
        document.getElementById('checkinBtn').disabled = true;
        document.getElementById('checkoutBtn').disabled = true;
        setTimeout(() => {
            if (currentEmployee) {
                document.getElementById('checkinBtn').disabled = false;
                document.getElementById('checkoutBtn').disabled = false;
            }
        }, 3000);
        
    } catch (error) {
        showMessage('❌ ບັນທຶກບໍ່ສຳເລັດ: ' + error.message, 'error');
    }
}

// Helper functions
function updateStatus(elementId, message, type) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = message;
        el.style.color = type === 'error' ? '#f44336' : '#4CAF50';
    }
}

function showMessage(message, type) {
    const msgEl = document.getElementById('message');
    if (msgEl) {
        msgEl.textContent = message;
        msgEl.className = `message ${type}`;
        setTimeout(() => {
            msgEl.textContent = '';
            msgEl.className = 'message';
        }, 3000);
    }
}

function updateTime() {
    const timeEl = document.getElementById('currentTime');
    if (timeEl) {
        const now = new Date();
        timeEl.innerHTML = `🕐 ${now.toLocaleTimeString('lo-LA')} | ${now.toLocaleDateString('lo-LA')}`;
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    video = document.getElementById('video');
    canvas = document.getElementById('overlay');
    
    updateTime();
    setInterval(updateTime, 1000);
    
    // Load models
    await loadModels();
    
    // Start camera button
    const startBtn = document.getElementById('startCameraBtn');
    if (startBtn) {
        startBtn.onclick = startCamera;
    }
    
    // Attendance buttons
    const checkinBtn = document.getElementById('checkinBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    if (checkinBtn) {
        checkinBtn.onclick = () => recordAttendance('checkin');
    }
    if (checkoutBtn) {
        checkoutBtn.onclick = () => recordAttendance('checkout');
    }
    
    // Try to get location on load
    try {
        await getLocation();
    } catch (error) {
        console.error('GPS error:', error);
    }
    
    // Theme toggle
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.onclick = () => {
            document.body.classList.toggle('dark');
            themeBtn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
            localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
        };
        
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark');
            themeBtn.textContent = '☀️';
        }
    }
});