export const CITY = {
  name: 'Solmar Bay', size: 1500, shore: 374, roadWidth: 23,
  streetsX: [-660, -540, -420, -300, -180, -60, 60, 180, 320],
  streetsZ: [-690, -550, -410, -270, -130, 10, 150, 290, 430, 570, 710],
  spawn: { x: 329, y: 0.18, z: 359, yaw: 0.08 },
  landmarks: [
    { name: 'Solmar Exchange', x: -123, z: -340, kind: 'bank' },
    { name: 'Marlin Terminal', x: 267, z: -626, kind: 'docks' },
    { name: 'The Sunline', x: 358, z: 292, kind: 'beach' },
    { name: 'Crescent Park', x: -362, z: 358, kind: 'park' },
    { name: 'Vista Ridge', x: -703, z: 472, kind: 'hill' },
    { name: 'Morrow Tower', x: -92, z: -174, kind: 'tower' },
  ],
};
export const BRANDS = ['SUNLINE', 'VERVE', 'CORAL CLUB', 'LUMA', 'TIDELINE', 'MORROW', 'CITRINE', 'PALM & CO.'];
export function districtAt(x, z) {
  if (z < -470) return 'MARLIN DOCKS'; if (x > 230) return 'SUNLINE COAST';
  if (x < -570) return 'VISTA RIDGE'; if (z > 290) return 'CRESCENT QUARTER';
  if (x > -270 && x < 130 && z < 100) return 'GLASS DISTRICT'; return 'OLD SOLMAR';
}
