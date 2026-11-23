const scenes = {
  factory: {
    name: 'Factory valve station',
    source: 'https://www.pexels.com/video/industrial-worker-operating-equipment-safely-35682326/',
    zone: [[5, 83], [34, 80], [36, 100], [5, 100]],
    tracks: [{id: 'Worker 1', helmet: true, workwear: true, points: [[0, 43, 96], [1, 40, 97], [3, 34, 98], [5, 30, 98], [7, 27, 98], [9, 28, 98]]}],
  },
  warehouse: {
    name: 'Warehouse aisle',
    source: 'https://www.pexels.com/video/workers-with-safety-helmets-in-warehouse-10817415/',
    zone: [[53, 76], [66, 72], [83, 100], [56, 100]],
    tracks: [
      {id: 'Worker 1', helmet: true, workwear: true, points: [[0, 36, 92], [1, 36, 94], [3, 39, 95], [5, 40, 96], [7, 42, 97], [9, 42, 97], [11, 36, 98], [13, 33, 98]]},
      {id: 'Worker 2', helmet: true, workwear: true, points: [[0, 52, 98], [1, 54, 98], [3, 54, 98], [5, 55, 98], [7, 56, 98], [9, 59, 98], [11, 60, 98], [13, 57, 98], [15, 54, 98]]},
    ],
  },
};

function positionAt(points, time) {
  const nextIndex = points.findIndex(point => point[0] > time);
  if (nextIndex === 0) return points[0].slice(1);
  if (nextIndex === -1) return points.at(-1).slice(1);
  const [start, x, y] = points[nextIndex - 1];
  const [end, nextX, nextY] = points[nextIndex];
  const progress = (time - start) / (end - start);
  return [x + (nextX - x) * progress, y + (nextY - y) * progress];
}

function insideZone([x, y], polygon) {
  let inside = false;
  for (let i = 0, previous = polygon.length - 1; i < polygon.length; previous = i++) {
    const [ax, ay] = polygon[previous];
    const [bx, by] = polygon[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) < 1e-8 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx)
        && y >= Math.min(ay, by) && y <= Math.max(ay, by)) return true;
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
  }
  return inside;
}

function stateAt(scene, time) {
  return scene.tracks.map(track => {
    const point = positionAt(track.points, time);
    return {...track, point, exposed: insideZone(point, scene.zone)};
  });
}

function historyAt(scene, time) {
  const events = [];
  let previous = new Set();
  let peak = 0;
  for (let frame = 0; frame <= Math.floor(time * 24); frame++) {
    const visible = stateAt(scene, frame / 24);
    const occupants = new Set(visible.filter(worker => worker.exposed).map(worker => worker.id));
    peak = Math.max(peak, occupants.size);
    for (const worker of visible) {
      if (occupants.has(worker.id) !== previous.has(worker.id)) {
        events.push({time: frame / 24, id: worker.id, entered: occupants.has(worker.id)});
      }
    }
    previous = occupants;
  }
  return {events, peak};
}

const get = id => document.getElementById(id);
const video = get('safety-video');
const svg = 'http://www.w3.org/2000/svg';
const selector = get('scene');
let lastLog;
let markers = [];
const timestamp = time => '00:' + String(Math.floor(time)).padStart(2, '0') + '.' + String(Math.floor(time % 1 * 10));

function update() {
  const scene = scenes[selector.value];
  const time = video.currentTime;
  const workers = stateAt(scene, time);
  const exposed = workers.filter(worker => worker.exposed).length;
  const withPPE = workers.filter(worker => worker.helmet && worker.workwear).length;
  get('workers').textContent = workers.length;
  get('inside').textContent = exposed;
  get('inside').dataset.level = exposed ? 'critical' : 'normal';
  get('population').textContent = workers.length ? Math.round(exposed / workers.length * 100) + '%' : '—';
  get('ppe').textContent = withPPE + ' / ' + workers.length;
  const status = get('zone-status');
  const label = exposed ? 'Danger zone occupied' : 'Danger zone clear';
  if (status.textContent !== label) status.textContent = label;
  status.dataset.level = exposed ? 'critical' : 'normal';
  get('danger-polygon').classList.toggle('active', Boolean(exposed));
  workers.forEach(({point: [x, y], exposed}, index) => {
    markers[index].setAttribute('cx', x);
    markers[index].setAttribute('cy', y);
    markers[index].classList.toggle('exposed', exposed);
  });
  const {events, peak} = historyAt(scene, time);
  get('peak').textContent = 'Peak ' + peak + ' in zone';
  get('zone-advice').textContent = exposed
    ? 'Verify who is inside and follow the site’s exclusion-zone procedure. PPE does not clear a zone occupancy alert.'
    : 'The exclusion zone is clear at this point in the replay.';
  const signature = JSON.stringify(events);
  if (signature === lastLog) return;
  lastLog = signature;
  const rows = events.slice().reverse().map(event => {
    const row = document.createElement('article');
    row.className = 'event';
    const clock = document.createElement('time');
    clock.textContent = timestamp(event.time);
    const description = document.createElement('span');
    description.textContent = event.id + (event.entered ? ' entered the zone' : ' exited the zone');
    row.append(clock, description);
    return row;
  });
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No zone events at this point in the replay.';
    rows.push(empty);
  }
  get('safety-log').replaceChildren(...rows);
}

function loadScene() {
  const key = selector.value;
  const scene = scenes[key];
  get('scene-name').textContent = scene.name;
  get('footage-source').href = scene.source;
  get('danger-polygon').setAttribute('points', scene.zone.map(point => point.join(',')).join(' '));
  video.parentElement.classList.toggle('portrait', key === 'factory');
  video.poster = 'safety-' + key + '.jpg';
  video.src = 'safety-' + key + '.mp4';
  markers = scene.tracks.map(() => {
    const marker = document.createElementNS(svg, 'circle');
    marker.setAttribute('r', '1.15');
    marker.classList.add('worker-marker');
    return marker;
  });
  get('worker-markers').replaceChildren(...markers);
  lastLog = undefined;
  update();
}

selector.addEventListener('change', loadScene);
for (const event of ['timeupdate', 'seeked', 'loadedmetadata']) video.addEventListener(event, update);
video.addEventListener('error', () => { get('zone-status').textContent = 'Replay unavailable'; });
loadScene();