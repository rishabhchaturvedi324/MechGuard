# MechGuard AI

MechGuard AI is a browser-based prototype for industrial machine health and worker safety monitoring. It combines simulated equipment readings, video replays of exclusion-zone events, and live webcam person detection.

## Run locally

Open the project folder in VS Code and run this command in the terminal:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/` in a modern browser. The project uses HTML, CSS, and JavaScript and runs without an npm install or build step. The live camera page requires browser camera permission and internet access to download the detection model.

## Implementation techniques

### Operations dashboard

`index.html` and `demo.js` synchronize a conveyor scenario with the video playback position. Vibration, temperature, and motor current are generated at quarter-second intervals using trigonometric variation, a logistic fault curve, and a gradual temperature ramp. A motor alert requires two consecutive vibration readings above the configured limit. The dashboard marks risk as critical when a motor alert and a scripted safety event are active together.

### Machine monitoring simulator

`machines.html`, `machines.js`, and `profiles.js` provide 16 machine profiles with configurable sensor baselines, operating changes, fault effects, and deviation thresholds. Each 45-second run precomputes one sample row per second, including the starting row at zero. Expected readings follow the operating change. Simulated readings add sinusoidal noise and a gradual fault effect.

The anomaly rule checks whether a reading deviates from its expected value in the configured fault direction. An alert triggers after three consecutive samples with at least two flagged channels, or after one flagged channel per sample when the profile has only one monitored channel. A timer drives playback, and array indexing lets users scrub directly to a sample. Canvas charts display expected and simulated readings.

### Worker safety replay

`safety.html` and `safety.js` replay prerecorded factory and warehouse footage using predefined worker positions and protective equipment flags. Linear interpolation estimates each worker’s position between timestamped points. A ray-casting point-in-polygon test determines whether the worker is inside the exclusion zone. Points on the boundary count as inside.

The replay reconstructs occupancy history at 24 samples per second up to the current video time. It compares sets of worker IDs between samples to identify zone entries and exits and calculate peak occupancy. An SVG overlay displays the zone and worker markers.

### Live camera detection

`live-camera.html` and `live-camera.js` request a webcam stream through the browser’s `getUserMedia()` API. TensorFlow.js runs the pretrained COCO-SSD Lite MobileNet V2 model in the browser. The page keeps `person` detections with confidence scores of at least 0.55 and uses each bounding box’s bottom-center point to check whether the person is inside an adjustable rectangular zone.

An asynchronous loop analyzes new frames, and a watchdog tracks stale results. A Canvas overlay draws detection boxes and the zone. Stopping the camera releases the media tracks and clears the session timers.

## Data structures

| Structure | Fields or representation | Purpose |
| --- | --- | --- |
| Metric configuration | Object keyed by `vib`, `temp`, and `amps`. Each entry contains `unit`, `label`, `limit`, and `range`. | Configures dashboard charts and reading thresholds. |
| Dashboard readings | `{vib, temp, amps}` | Stores the simulated conveyor readings for one timestamp. |
| Machine profile | `[name, operatingChange, fault, action, sensors]` | Groups scenario descriptions and sensor definitions by machine. A parallel array stores each profile’s fault ramp duration. |
| Sensor definition | `{name, unit, baseline, noise, operatingChange, faultChange, sensitivity}` | Defines how to generate a reading and flag a deviation. |
| Machine time series | Array of `{samples, alertAt}` rows. Each channel sample is `{expected, value, deviates}`. | Supports playback, charting, and direct access by elapsed second. |
| Safety scene | Object keyed by scene name. Each scene contains `{name, source, zone, tracks}`. | Groups footage attribution, exclusion-zone geometry, and worker tracks. |
| Zone and worker track | Zone vertices are `[x, y]` pairs. Worker records contain `{id, helmet, workwear, points}`, with `[time, x, y]` points in normalized video coordinates. | Positions workers and zones consistently as the replay display resizes. |
| Occupancy history | A `Set` of worker IDs per sample and an array of `{time, id, entered}` events. | Detects occupancy changes and builds the replay log. |
| Live detection | `{class, score, bbox}` with `bbox` stored as `[x, y, width, height]` in pixels. | Filters person detections and supplies coordinates for overlays and zone checks. |

Simulation data and event history are computed in browser memory. The project requires no database, equipment sensor connection, or application backend.

## Prototype scope

Machine readings and safety replay annotations are simulated or predefined. The webcam feature detects people and estimates zone occupancy. Use the project for demonstrations and evaluation of the monitoring interface.

## License

Project code is available under the [MIT License](LICENSE). See [the bundled Apache 2.0 notice](vendor/LICENSE-APACHE-2.0.txt) for the included libraries. Demo footage credits are provided on the safety replay page.
