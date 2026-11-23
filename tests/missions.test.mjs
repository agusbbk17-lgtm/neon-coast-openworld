import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MissionStateMachine } from '../game/src/systems/mission-state.js';
import { MISSION_DEFINITIONS } from '../game/src/data/missions.js';

const context = () => ({ player: { x: 0, z: 0 }, enterSerial: 1, inVehicle: true, speed: 0, target: { x: 0, z: -20 }, targetHealth: 72, wanted: 0, interact: false, dead: false });
test('First Delivery requires a new entry and a slow vehicle at the dock', () => {
  const machine = new MissionStateMachine(), c = context(); machine.start(MISSION_DEFINITIONS[0], c, true);
  machine.update(0.1, c); assert.equal(machine.index, 0); c.enterSerial++; machine.update(0.1, c); assert.equal(machine.index, 1);
  c.player = { x: 320, z: -610 }; c.speed = 20; machine.update(0.1, c); assert.equal(machine.state, 'active');
  c.speed = 0; machine.update(0.1, c); assert.equal(machine.state, 'complete');
});
test('Heat Wave follows enter, chase, destruction, then escape', () => {
  const machine = new MissionStateMachine(), c = context(); machine.start(MISSION_DEFINITIONS[1], c, true);
  machine.update(0.1, c); machine.update(0.1, c); assert.equal(machine.step.type, 'destroy');
  c.targetHealth = 0; machine.update(0.1, c); assert.equal(machine.step.type, 'escape');
  c.wanted = 3; machine.update(0.1, c); assert.equal(machine.state, 'active'); c.wanted = 0; machine.update(0.1, c); assert.equal(machine.state, 'complete');
});
test('destroying the rival early cannot strand the chase objective', () => {
  const machine = new MissionStateMachine(), c = context(); machine.start(MISSION_DEFINITIONS[1], c, true);
  machine.update(0.1, c); c.target = { x: 0, z: -100 }; c.targetHealth = 0;
  machine.update(0.1, c); assert.equal(machine.step.type, 'destroy');
  machine.update(0.1, c); assert.equal(machine.step.type, 'escape');
});
test('Vault Run holds an on-foot interaction and retries its checkpoint', () => {
  const machine = new MissionStateMachine(), c = context(); machine.start(MISSION_DEFINITIONS[2], c, true); c.player = { x: -180, z: -330 };
  machine.update(0.1, c); assert.equal(machine.step.type, 'interact'); assert.equal(machine.checkpoint, 1);
  machine.fail('caught'); machine.retry(c); assert.equal(machine.index, 1); assert.equal(machine.state, 'active');
  c.player = { x: -125, z: -330 }; c.inVehicle = false; c.interact = true;
  for (let i = 0; i < 17; i++) machine.update(0.25, c); assert.equal(machine.state, 'complete');
});
test('timed and survive objectives respect deadlines, death and retry', () => {
  const machine = new MissionStateMachine(), c = context(); machine.start({ steps: [{ type: 'timed', target: { x: 100, z: 100 }, limit: 1 }] }, c, true);
  for (let i = 0; i < 5; i++) machine.update(0.25, c); assert.equal(machine.state, 'failed');
  machine.start({ steps: [{ type: 'survive', duration: 1 }] }, c, true); for (let i = 0; i < 4; i++) machine.update(0.25, c); assert.equal(machine.state, 'complete');
  machine.start(MISSION_DEFINITIONS[0], c, true); c.dead = true; machine.update(0.1, c); assert.equal(machine.state, 'failed');
});
