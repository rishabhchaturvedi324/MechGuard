const sensor = (name, unit, baseline, noise, operatingChange, faultChange, sensitivity = 0) =>
  ({name, unit, baseline, noise, operatingChange, faultChange, sensitivity});
const vibration = (baseline, change, fault, sensitivity) => sensor('Vibration RMS', 'mm/s', baseline, .12, change, fault, sensitivity);
const temperature = (baseline, change, fault, sensitivity = 0) => sensor('Temperature', '°C', baseline, .22, change, fault, sensitivity);
const current = (baseline, change, fault, sensitivity = 0) => sensor('Motor current', 'A', baseline, .13, change, fault, sensitivity);
const rpm = (baseline, change) => sensor('Shaft speed', 'rpm', baseline, 4, change, 0);

const machines = [
  ['Centrifugal pump', 'Flow demand increases', 'Suspected cavitation or suction restriction', 'Vibration rises as suction pressure and flow fall. Check inlet conditions and inspect for restrictions.', [
    vibration(2.2,.6,3.5,1.6), sensor('Suction pressure','bar(g)',.82,.025,-.12,-.53,.22), sensor('Flow','m³/h',32,.6,10,-12,5), current(8.2,1.5,-.4), temperature(42,.8,2)]],
  ['Industrial fan', 'Speed increases to meet airflow demand', 'Possible rotor imbalance', 'The rotation-frequency component rises at stable speed. Check rotor buildup, balance, and mounting.', [
    sensor('1× shaft vibration','mm/s',1.1,.07,.8,3.3,1.4), rpm(980,470), vibration(1.8,1,3.2,1.4), current(4.3,2.2,.2), temperature(45,.9,.5)]],
  ['Hydraulic press', 'Cycle profile changes for a heavier part', 'Possible hydraulic leakage', 'Hold pressure falls as pressure build time increases. Check the hydraulic circuit and compare equivalent cycles.', [
    sensor('Hold pressure','bar',128,1.8,22,-36,15), sensor('Pressure build time','s',1.7,.06,.45,1.45,.6), temperature(47,2,8,4.5), current(12,3.3,1.6)]],
  ['Gearbox / geared drive', 'Drive torque increases under load', 'Possible gear tooth degradation', 'Gear-mesh energy and vibration impulses rise together. Inspect gears, alignment, and lubricant condition.', [
    sensor('Gear-mesh vibration','mm/s',.8,.07,.3,2.8,1.1), sensor('Vibration crest factor','ratio',3.1,.12,.25,2.8,1.2), vibration(1.7,.5,2.4), rpm(1480,0), temperature(51,1.5,6,4)]],
  ['Belt conveyor', 'Product load increases', 'Possible drive or bearing fault', 'Vibration and current rise beyond the expected load response. Inspect the drive and bearings.', [
    vibration(2.1,.45,4.2,1.6), temperature(53,1.2,13,7), current(4.2,1,2.9,1.1), sensor('Belt speed','m/s',1.25,.015,0,-.09)]],
  ['Air compressor', 'Air demand increases', 'Possible compression efficiency loss', 'Discharge pressure sags while current and temperature rise. Review demand, leaks, and compressor condition.', [
    sensor('Discharge pressure','bar(g)',7.2,.1,-.2,-1.8,.8), current(16,2.8,4,1.8), temperature(69,2,16,7), vibration(2.3,.5,1.2)]],
  ['Industrial blower', 'Airflow setpoint increases', 'Possible inlet or filter restriction', 'Differential pressure increases as measured airflow falls. Check the filter and inlet path.', [
    sensor('Filter differential pressure','Pa',80,3,35,130,55), sensor('Airflow','m³/h',1800,19,350,-600,240), vibration(1.8,.45,.7), current(6,1.3,-.5)]],
  ['Mixer', 'Recipe switches to a thicker batch', 'Possible impeller buildup or drag', 'Torque and current exceed what the recipe change explains. Review the batch and inspect the impeller.', [
    sensor('Shaft torque','N·m',24,.8,12,19,8), current(5.4,1.8,2.8,1.3), vibration(1.8,.35,1.9,1), rpm(260,-20)]],
  ['Centrifuge', 'Spin speed increases', 'Possible load imbalance', 'Rotation-frequency vibration rises above the speed-adjusted expectation. Follow the site imbalance procedure.', [
    sensor('1× shaft vibration','mm/s',1,.09,.7,4.4,1.8), rpm(1400,1100), current(8,1.8,.5), temperature(43,1.4,2)]],
  ['CNC spindle', 'Tool changes to a heavier cut', 'Possible tool wear or chatter', 'Chatter-band vibration and cutting current rise. Review tool condition and machining parameters.', [
    sensor('Chatter-band vibration','mm/s',.55,.07,.4,2.5,1), current(6,2.5,3.4,1.4), rpm(4200,1800), temperature(37,1.5,3)]],
  ['Injection moulding machine', 'Recipe switches to a larger shot', 'Possible flow restriction', 'Peak injection pressure and fill time climb together. Review material, temperature, and the flow path.', [
    sensor('Peak injection pressure','bar',640,9,95,220,90), sensor('Fill time','s',1.1,.04,.3,.75,.28), sensor('Melt temperature','°C',215,.6,6,-4), current(18,3,5,2.5)]],
  ['Robotic actuator', 'Robot moves a heavier payload', 'Possible joint friction', 'Torque and position error grow for the same payload. Check joint condition and compare the same move.', [
    sensor('Joint torque','N·m',18,.8,10,16,7), sensor('Position error','°',.08,.013,.04,.33,.14), current(3.2,1.5,2.8,1), temperature(40,1.1,4)]],
  ['Hoist / elevator drive', 'Payload increases during the lift', 'Possible mechanical drag', 'Drive current rises while speed drops for the same payload. Send the trend to qualified maintenance.', [
    current(12,6,8,3.2), sensor('Travel speed','m/s',1.1,.014,-.03,-.26,.1), vibration(1.9,.5,2.5,1.1), temperature(46,1.5,6)]],
  ['Motor control panel', 'Connected load increases', 'Possible high-resistance connection', 'One simulated terminal heats relative to the others under comparable current. Arrange a qualified inspection.', [
    sensor('Terminal temperature','°C',40,.35,3,29,11), sensor('Peer terminal temperature','°C',39,.3,3,1), sensor('Line current','A',21,.6,10,.3)]],
  ['Transformer', 'Facility electrical demand increases', 'Possible cooling degradation', 'Oil temperature rises beyond the load-adjusted trend while cooling airflow falls. Check fan and airflow status.', [
    sensor('Top oil temperature','°C',54,.3,4,23,9), sensor('Cooling airflow','m³/h',1600,20,250,-900,350), sensor('Load current','A',90,1.5,30,0)]],
  ['Industrial oven', 'Temperature setpoint increases', 'Possible circulation fan degradation', 'Cabinet temperature spread and fan vibration grow as airflow falls. Check circulation and the fan assembly.', [
    sensor('Temperature spread','°C',4,.25,1,14,5), vibration(1.5,.35,2.9,1.3), sensor('Circulation airflow','m³/h',900,10,100,-390,150), sensor('Chamber temperature','°C',160,.5,20,-3)]],
];
