const get = id => document.getElementById(id);
const video = get('live-video');
const overlay = get('live-overlay');
const context = overlay.getContext('2d');
const startButton = get('start-camera');
const stopButton = get('stop-camera');
const detectionLimit = .55;
const staleAfter = 5000;
let session;
let modelPromise;

function publishStatus(label, message, level = 'normal') {
  const status = get('live-status');
  if (status.textContent !== label) status.textContent = label;
  status.dataset.level = level;
  get('live-message').textContent = message;
}

function clearReading() {
  for (const id of ['visible-count', 'zone-count', 'live-index']) get(id).textContent = '—';
  get('zone-count').dataset.level = 'normal';
}

function showDetections(predictions, width, height) {
  const left = Number(get('zone-left').value) / 100 * width;
  const top = Number(get('zone-top').value) / 100 * height;
  const people = predictions.filter(({class: label, score}) => label === 'person' && score >= detectionLimit);
  let inside = 0;
  for (const {bbox: [x, y, w, h]} of people) {
    if (x + w / 2 >= left && x + w / 2 <= width && y + h >= top) inside++;
  }
  get('visible-count').textContent = people.length;
  get('zone-count').textContent = inside;
  get('zone-count').dataset.level = inside ? 'critical' : 'normal';
  get('live-index').textContent = people.length ? Math.round(100 * inside / people.length) + '%' : '—';
  get('last-frame').textContent = new Date().toLocaleTimeString();
  publishStatus(inside ? 'Zone occupied' : 'Live camera', inside
    ? 'A person was detected in the marked zone.'
    : 'Latest frame analyzed. No person was detected in the marked zone.', inside ? 'critical' : 'normal');

  if (overlay.width !== width || overlay.height !== height) {
    overlay.width = width;
    overlay.height = height;
    get('live-screen').style.aspectRatio = width + '/' + height;
  }
  context.clearRect(0, 0, width, height);
  context.lineWidth = Math.max(2, width / 320);
  context.fillStyle = inside ? '#ff61555a' : '#ff615530';
  context.strokeStyle = '#ff9a96';
  context.fillRect(left, top, width - left, height - top);
  context.strokeRect(left, top, width - left, height - top);
  for (const {bbox: [x, y, w, h]} of people) {
    context.strokeStyle = '#64e0cd';
    context.strokeRect(x, y, w, h);
  }
}

function stopCamera(label = 'Camera off', message = 'Select Start camera to resume the live preview.', level = 'normal') {
  const previous = session;
  session = undefined;
  if (previous) {
    clearTimeout(previous.timer);
    clearInterval(previous.watchdog);
    previous.stream?.getTracks().forEach(track => track.stop());
  }
  video.srcObject = null;
  context.clearRect(0, 0, overlay.width, overlay.height);
  clearReading();
  get('last-frame').textContent = '—';
  startButton.disabled = false;
  stopButton.disabled = true;
  get('camera-direction').disabled = false;
  publishStatus(label, message, level);
}

async function analyze(current, model) {
  if (session !== current) return;
  try {
    const frameTime = video.currentTime;
    if (video.readyState >= 2 && frameTime !== current.frameTime) {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const predictions = await model.detect(video, 40, detectionLimit);
      if (session !== current) return;
      current.frameTime = frameTime;
      current.lastAnalysis = Date.now();
      showDetections(predictions, width, height);
    }
    current.timer = setTimeout(() => analyze(current, model), 350);
  } catch {
    if (session !== current) return;
    clearInterval(current.watchdog);
    clearReading();
    context.clearRect(0, 0, overlay.width, overlay.height);
    publishStatus('Preview only', 'The detection model could not analyze video. The camera preview is still live.', 'warning');
  }
}

async function startCamera() {
  if (session) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    publishStatus('Camera unavailable', 'Open MechGuard directly in an HTTPS browser that supports camera access.', 'warning');
    return;
  }
  const current = {};
  session = current;
  startButton.disabled = true;
  stopButton.disabled = false;
  get('camera-direction').disabled = true;
  publishStatus('Waiting for camera', 'Allow camera access in the browser prompt.');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: get('camera-direction').value }, width: { ideal: 960 }, height: { ideal: 540 } },
    });
    if (session !== current) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    current.stream = stream;
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', () => {
        if (session === current) stopCamera('Camera disconnected', 'Reconnect the camera, then select Start camera.', 'warning');
      });
    }
    video.srcObject = stream;
    await video.play();
    if (session !== current) return;
  } catch (error) {
    if (session !== current) return;
    stopCamera('Camera unavailable', error.name === 'NotAllowedError'
      ? 'Camera access was denied. Allow it in your browser’s site settings and try again.'
      : 'Check that a camera is connected and available, then try again.', 'warning');
    return;
  }

  publishStatus('Loading person detector', 'The video preview is live. Counts will appear when the model is ready.');
  try {
    modelPromise ??= Promise.resolve().then(() => cocoSsd.load({base:'lite_mobilenet_v2'})).catch(error => {
      modelPromise = undefined;
      throw error;
    });
    const model = await modelPromise;
    if (session !== current) return;
    current.lastAnalysis = Date.now();
    current.watchdog = setInterval(() => {
      if (Date.now() - current.lastAnalysis <= staleAfter) return;
      clearReading();
      context.clearRect(0, 0, overlay.width, overlay.height);
      publishStatus('Stale camera data', 'Waiting for a fresh analyzed frame.', 'warning');
    }, 1000);
    analyze(current, model);
  } catch {
    if (session === current) publishStatus('Preview only', 'The person detector could not load. The camera preview is still live.', 'warning');
  }
}

startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', () => stopCamera());
window.addEventListener('pagehide', () => stopCamera());
