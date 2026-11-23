export const MISSION_DEFINITIONS = [
  { id: 'first-delivery', name: 'First Delivery', reward: 900, intro: 'MARA VALE: Rian, the Vela is borrowed. Find another ride, then bring it to Marlin. No questions.',
    description: 'Borrow a car and deliver it to Marlin Terminal.', steps: [
      { type: 'enter', newEntry: true, text: 'Take a car. E exits your current ride; E near any car takes it.', checkpoint: true, dialogue: 'MARA: Solmar never runs out of cars. Pick one that runs.' },
      { type: 'deliver', target: { x: 320, z: -610 }, radius: 17, text: 'Deliver the car to Marlin Terminal. Slow down inside the gold marker.', limit: 240, dialogue: 'MARA: North along Sunline. Look for the cranes. The money is waiting.' },
    ] },
  { id: 'heat-wave', name: 'Heat Wave', reward: 1600, intro: 'MARA VALE: Voss Pike took our route book. He is cutting through live traffic in a red Jackal. Stop that car.',
    description: 'Catch a rival through traffic, destroy his car and escape the heat.', steps: [
      { type: 'enter', text: 'Get a fast vehicle. E takes a nearby car.', checkpoint: true },
      { type: 'chase', radius: 55, dynamic: true, text: 'Close in on Voss. Follow the red Jackal through traffic.', limit: 180, dialogue: 'VOSS PIKE: This city belongs to whoever gets there first.' },
      { type: 'destroy', dynamic: true, text: 'Take out the red Jackal. LMB fires; wheel/4 selects the SMG. R reloads.', limit: 180, checkpoint: true },
      { type: 'escape', text: 'Lose the police. Break line of sight and stay out of the flashing search cones.', dialogue: 'MARA: The book was a decoy. What matters is that he knows we are still here.' },
    ] },
  { id: 'vault-run', name: 'Vault Run', reward: 2400, intro: 'MARA VALE: The Exchange launders the coast clean. Tonight we take a little of our own sunshine back.',
    description: 'Breach the Exchange, trigger three stars and disappear into Solmar.', steps: [
      { type: 'goto', target: { x: -180, z: -330 }, radius: 14, text: 'Reach the Exchange parking entrance in the Glass District.', checkpoint: true },
      { type: 'interact', target: { x: -125, z: -330 }, approach: { x: -180, z: -330 }, radius: 8, duration: 4, text: 'Go on foot through the alley. Hold E / Y at the vault entrance.', checkpoint: true, dialogue: 'MARA: Four seconds. Keep your nerve.' },
      { type: 'escape', text: 'Three stars. Escape Solmar police and finish the search timer.', minHeat: 52, dialogue: 'RIAN CALDER: They can keep the glass towers. I am taking the coast.' },
    ] },
];
