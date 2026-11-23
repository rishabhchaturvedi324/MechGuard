const duration = 45;
const faultLengths = [10, 18, 20, 19, 14, 18, 12, 10, 8, 11, 16, 14, 10, 23, 22, 19];
const byId = id => document.getElementById(id);
const machine = byId('machine');
const channel = byId('channel');
const trend = byId('trend');
const chart = trend.getContext('2d');
let time = 0;
let timer;
let run = [];
let cards = [];
let lastIncident = '';

const ramp = (t, start, length) => Math.max(0, Math.min(1, (t - start) / length));
const stamp = t => '00:' + String(t).padStart(2, '0');
const display = (value, unit) => value.toFixed(Math.abs(value) >= 100 ? 0 : unit === '°C' ? 1 : 2);
const option = (label, index) => new Option(label, index);

function buildRun(sensors, faultLength) {
  let streak = 0;
  let alertAt = null;
  return Array.from({length: duration + 1}, (_, t) => {
    const samples = sensors.map((sensor, index) => {
      const expected = sensor.baseline + ramp(t, 8, 6) * sensor.operatingChange;
      const noise = sensor.noise * (Math.sin(t * 1.51 + index) + 0.32 * Math.sin(t * 2.37 + index));
      const value = expected + noise + ramp(t, 22, faultLength) * sensor.faultChange;
      const deviates = sensor.sensitivity > 0
        && Math.sign(sensor.faultChange) * (value - expected) >= sensor.sensitivity;
      return {expected, value, deviates};
    });
    const flagged = samples.filter(sample => sample.deviates).length;
    const checks = sensors.filter(sensor => sensor.sensitivity > 0).length;
    streak = flagged >= Math.min(2, checks) ? streak + 1 : 0;
    if (streak >= 3 && alertAt === null) alertAt = t;
    return {samples, alertAt};
  });
}

function selectMachine() {
  const sensors = machines[machine.value][4];
  channel.replaceChildren(...sensors.map((sensor, index) => option(sensor.name, index)));
  cards = sensors.map(sensor => {
    const card = document.createElement('article');
    const label = document.createElement('span');
    const value = document.createElement('strong');
    const expected = document.createElement('small');
    label.textContent = sensor.name;
    card.append(label, value, expected);
    return {card, value, expected};
  });
  byId('readings').replaceChildren(...cards.map(card => card.card));
  run = buildRun(sensors, faultLengths[machine.value]);
  time = 0;
  render();
}

function draw() {
  const {width, height} = trend.getBoundingClientRect();
  if (!width || !height || !run.length) return;
  const index = Number(channel.value);
  const sensor = machines[machine.value][4][index];
  trend.setAttribute('aria-label', sensor.name + ' trend in ' + sensor.unit);
  const samples = run.map(row => row.samples[index]);
  const values = samples.flatMap(sample => [sample.value, sample.expected]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const margin = (high - low) * .15 || 1;
  const min = low - margin;
  const max = high + margin;
  const ratio = window.devicePixelRatio || 1;
  const bottom = height - 27;
  const x = t => 58 + t / duration * (width - 80);
  const y = value => bottom - (value - min) / (max - min) * (height - 45);
  if (trend.width !== Math.round(width * ratio) || trend.height !== Math.round(height * ratio)) {
    trend.width = Math.round(width * ratio);
    trend.height = Math.round(height * ratio);
  }
  chart.setTransform(ratio, 0, 0, ratio, 0, 0);
  chart.clearRect(0, 0, width, height);
  chart.font = '12px system-ui';
  chart.fillStyle = '#aab7c3';
  chart.strokeStyle = '#29353f';
  chart.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const value = min + (max - min) * i / 4;
    chart.beginPath();
    chart.moveTo(x(0), y(value));
    chart.lineTo(x(duration), y(value));
    chart.stroke();
    chart.fillText(display(value, sensor.unit), 6, y(value) + 4);
  }
  for (const t of [0, 8, 22, 30, 45]) chart.fillText(t + 's', x(t) - 9, height - 8);
  for (const [key, color, dash] of [['expected', '#ffc47b', [6, 5]], ['value', '#64e0cd', []]]) {
    chart.strokeStyle = color;
    chart.fillStyle = color;
    chart.setLineDash(dash);
    chart.lineWidth = 2;
    chart.beginPath();
    chart.moveTo(x(0), y(samples[0][key]));
    for (let t = 1; t <= time; t++) chart.lineTo(x(t), y(samples[t][key]));
    chart.stroke();
    chart.beginPath();
    chart.arc(x(time), y(samples[time][key]), 3, 0, Math.PI * 2);
    chart.fill();
  }
}

function render() {
  const [, change, fault, action, sensors] = machines[machine.value];
  const {samples, alertAt} = run[time];
  samples.forEach(({value, expected, deviates}, index) => {
    const {unit} = sensors[index];
    const card = cards[index];
    card.value.textContent = display(value, unit) + ' ' + unit;
    card.value.dataset.level = deviates ? 'warning' : 'normal';
    card.expected.textContent = 'Expected ' + display(expected, unit) + ' ' + unit;
  });
  byId('phase').textContent = time < 8 ? 'Steady operation' : time < 22 ? change : 'Fault develops under the new operating conditions';
  byId('clock').textContent = stamp(time) + ' / ' + stamp(duration);
  byId('scrub').value = time;
  const condition = byId('condition');
  const status = alertAt !== null ? 'Anomaly detected' : samples.some(sample => sample.deviates) ? 'Checking deviation' : 'Within expected range';
  if (condition.textContent !== status) condition.textContent = status;
  condition.dataset.level = alertAt !== null ? 'warning' : 'normal';
  const incident = JSON.stringify([machine.value, time >= 8, alertAt]);
  if (incident !== lastIncident) {
    lastIncident = incident;
    byId('evidence').textContent = alertAt === null ? 'Readings are compared with the expected response for this operating condition.' : fault + '. ' + action;
    const entries = [['00:00', 'Monitoring begins']];
    if (time >= 8) entries.push(['00:08', change]);
    if (alertAt !== null) entries.push([stamp(alertAt), fault]);
    byId('machineLog').replaceChildren(...entries.map(([at, description]) => {
      const item = document.createElement('li');
      item.textContent = at + ' · ' + description;
      return item;
    }));
  }
  draw();
}

function pause() {
  clearInterval(timer);
  timer = undefined;
  byId('toggle').textContent = 'Play';
}

function play() {
  pause();
  if (time === duration) {
    time = 0;
    render();
  }
  byId('toggle').textContent = 'Pause';
  timer = setInterval(() => {
    time += 1;
    render();
    if (time === duration) pause();
  }, 1000 / Number(byId('speed').value));
}

machine.replaceChildren(...machines.map(([name], index) => option(name, index)));
machine.addEventListener('change', () => { selectMachine(); play(); });
channel.addEventListener('change', draw);
byId('toggle').addEventListener('click', () => timer === undefined ? play() : pause());
byId('reset').addEventListener('click', () => { time = 0; render(); play(); });
byId('speed').addEventListener('change', () => { if (timer !== undefined) play(); });
byId('scrub').addEventListener('input', event => { pause(); time = Number(event.target.value); render(); });
new ResizeObserver(draw).observe(trend);
selectMachine();
play();
