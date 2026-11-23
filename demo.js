const get = id => document.getElementById(id);
const video = get('video');
const chart = get('chart');
const seek = get('seek');
const duration = 24;
const metrics = {
  vib: { unit: 'mm/s', label: 'Vibration', limit: 4.5, range: [0, 8] },
  temp: { unit: '°C', label: 'Temperature', limit: 68, range: [40, 80] },
  amps: { unit: 'A', label: 'Current', limit: 6.4, range: [2, 10] },
};
const safetyEvents = {
  combined: ['Hazard-zone entry', 'Verify the camera event and follow the site’s exclusion-zone procedure.'],
  safety: ['Hazard-zone entry', 'Verify the camera event and follow the site’s exclusion-zone procedure.'],
  ppe: ['Missing PPE', 'Check helmet and vest compliance before work resumes.'],
  proximity: ['Unsafe proximity', 'Verify clearance around the conveyor and review the marked boundary.'],
};
const motorTime = 10;
const safetyTime = 15;
const safetyEnd = 21;
let lastLog = '';
let pendingSeek;
const timestamp = time => '00:' + String(Math.floor(time)).padStart(2, '0');

function readings(time, scenario) {
  const sampled = Math.floor(time * 4) / 4;
  const fault = scenario === 'motor' || scenario === 'combined';
  const progression = fault ? 1 / (1 + Math.exp(-(sampled - 9.8) * 1.25)) : 0;
  const heat = fault ? Math.min(1, Math.max(0, (sampled - 6) / 17)) : 0;
  const noise = Math.sin(sampled * 8.37) * Math.cos(sampled * 3.14);
  return {
    vib: 2.1 + 0.22 * Math.sin(sampled * 1.6) + 0.11 * noise + 4.45 * progression,
    temp: 53 + 0.12 * sampled + 0.2 * Math.sin(sampled * 0.7) + 16 * heat,
    amps: 4.2 + 0.24 * Math.sin(sampled * 1.3) + 0.09 * noise + 2.8 * progression,
  };
}

function draw(time, scenario) {
  const bounds = chart.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const ratio = devicePixelRatio || 1;
  const width = bounds.width;
  const height = bounds.height;
  if (chart.width !== Math.round(width * ratio) || chart.height !== Math.round(height * ratio)) {
    chart.width = Math.round(width * ratio);
    chart.height = Math.round(height * ratio);
  }
  const context = chart.getContext('2d');
  const key = get('metric').value;
  const { range, limit, label, unit } = metrics[key];
  chart.setAttribute('aria-label', label + ' replay trend, measured in ' + unit);
  const left = 38;
  const right = width - 19;
  const bottom = height - 28;
  const x = t => left + (right - left) * t / duration;
  const y = reading => bottom - (bottom - 17) * (reading - range[0]) / (range[1] - range[0]);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.font = '12px system-ui';
  context.fillStyle = '#aab7c3';
  for (let i = 0; i <= 4; i++) {
    const value = range[0] + i * (range[1] - range[0]) / 4;
    context.strokeStyle = '#29353f';
    context.beginPath();
    context.moveTo(left, y(value));
    context.lineTo(right, y(value));
    context.stroke();
    context.fillText(value.toString(), 8, y(value) + 4);
    const t = i * 6;
    context.fillText(t + 's', x(t) - 7, height - 9);
  }
  context.setLineDash([6, 5]);
  context.strokeStyle = '#ffc47b';
  context.beginPath();
  context.moveTo(left, y(limit));
  context.lineTo(right, y(limit));
  context.stroke();
  context.setLineDash([]);
  context.strokeStyle = '#64e0cd';
  context.fillStyle = '#64e0cd';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x(0), y(readings(0, scenario)[key]));
  for (let tick = 0.25; tick <= time; tick += 0.25) {
    context.lineTo(x(tick), y(readings(tick, scenario)[key]));
  }
  const current = y(readings(time, scenario)[key]);
  context.lineTo(x(time), current);
  context.stroke();
  context.beginPath();
  context.arc(x(time), current, 4, 0, Math.PI * 2);
  context.fill();
}

function render() {
  const time = pendingSeek ?? video.currentTime;
  const scenario = get('scenario').value;
  const samples = readings(time, scenario);
  const safety = safetyEvents[scenario];
  const activeSafety = safety && time >= safetyTime && time < safetyEnd;
  // Trigger on two consecutive samples above the demo vibration limit.
  const motor = time >= motorTime && samples.vib > metrics.vib.limit
    && readings(time - 0.25, scenario).vib > metrics.vib.limit;
  const combined = motor && activeSafety;
  for (const [key, metric] of Object.entries(metrics)) {
    get(key).textContent = samples[key].toFixed(1) + ' ' + metric.unit;
    get(key).dataset.level = samples[key] > metric.limit ? 'warning' : 'normal';
  }
  get('risk').textContent = combined ? 'Critical' : motor || activeSafety ? 'Elevated' : 'Normal';
  get('risk').dataset.level = combined ? 'critical' : motor || activeSafety ? 'warning' : 'normal';
  get('riskReason').textContent = combined ? 'Concurrent motor and safety events' : motor ? 'Motor vibration elevated' : activeSafety ? safety[0] : 'Motor and camera clear';
  get('cameraStatus').textContent = activeSafety ? 'Safety event' : 'Clear';
  get('cameraStatus').dataset.level = activeSafety ? 'critical' : 'normal';
  get('zone').hidden = !activeSafety || scenario === 'ppe';
  get('cameraEvent').hidden = !activeSafety;
  get('cameraEvent').textContent = activeSafety ? safety[0] : '';
  get('camTime').textContent = timestamp(time);
  get('position').textContent = timestamp(time) + ' / 00:24';
  seek.value = time;
  draw(time, scenario);

  const incidents = [];
  if (motor) incidents.push([motorTime, 'Elevated vibration · M‑01', 'Review the vibration trend and schedule an inspection of the drive and bearings.']);
  if (safety && time >= safetyTime) incidents.push([safetyTime, safety[0] + ' · CAM‑01', safety[1]]);
  if (motor && safety && time >= safetyTime) incidents.push([safetyTime, 'Combined risk · Packaging line A', 'Notify maintenance and the safety supervisor. Verify both alerts and follow site procedures.']);
  const log = JSON.stringify(incidents);
  if (log === lastLog) return;
  lastLog = log;
  get('count').textContent = incidents.length + (incidents.length === 1 ? ' event' : ' events');
  get('events').replaceChildren();
  if (!incidents.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No incidents at this replay position.';
    get('events').append(empty);
  }
  for (const [at, title, action] of incidents.reverse()) {
    const row = document.createElement('article');
    row.className = 'event';
    const timeNode = document.createElement('time');
    timeNode.textContent = timestamp(at);
    const details = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const description = document.createElement('p');
    description.textContent = action;
    details.append(heading, description);
    row.append(timeNode, details);
    get('events').append(row);
  }
}

function goTo(time) {
  if (video.readyState) video.currentTime = time;
  else pendingSeek = time;
  render();
}

async function play() {
  try {
    await video.play();
  } catch {
    get('cameraStatus').textContent = 'Replay unavailable';
  }
}

get('play').addEventListener('click', () => {
  if (video.paused) {
    if (video.ended) goTo(0);
    play();
  } else {
    video.pause();
  }
});
get('restart').addEventListener('click', () => goTo(0));
get('scenario').addEventListener('change', () => goTo(0));
get('metric').addEventListener('change', render);
seek.addEventListener('input', () => goTo(Number(seek.value)));
video.addEventListener('loadedmetadata', () => {
  if (pendingSeek !== undefined) {
    video.currentTime = pendingSeek;
    pendingSeek = undefined;
  }
  render();
});
video.addEventListener('error', () => {
  get('cameraStatus').textContent = 'Replay unavailable';
});
for (const event of ['seeked', 'timeupdate', 'play', 'pause', 'ended']) {
  video.addEventListener(event, () => {
    get('play').textContent = video.paused ? 'Play' : 'Pause';
    render();
  });
}
new ResizeObserver(render).observe(chart);
render();
