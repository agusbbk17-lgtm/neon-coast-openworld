import { Random } from '../core/rng.js';

export const STATIONS = [
  { name: 'SUNLINE 108.6', genre: 'Synthwave', track: 'Citrus Afterglow', bpm: 108, root: 45 },
  { name: 'BACKLOT 89.1', genre: 'Hip-hop', track: 'Dockside Arithmetic', bpm: 92, root: 38 },
  { name: 'TIDEPOOL 94.2', genre: 'Lo-fi', track: 'Tides Between Towers', bpm: 72, root: 50 },
];
export class Radio {
  constructor(audio, seed) { this.audio = audio; this.station = 0; this.beat = 0; this.nextBeat = 0; this.rng = new Random(seed + ':radio'); }
  cycle() { this.station = (this.station + 1) % 4; this.beat = 0; this.nextBeat = 0; return this.current; }
  get current() { return STATIONS[this.station] || null; }
  update(game) {
    const audio = this.audio, station = this.current;
    if (!station || !audio.started || !game.player.vehicle || audio.context.state !== 'running') { this.nextBeat = 0; return; }
    const now = audio.context.currentTime; if (this.nextBeat < now - 0.1) this.nextBeat = now + 0.04;
    let scheduled = 0;
    while (this.nextBeat < now + 0.12 && scheduled++ < 3) {
      this.schedule(station, this.beat++, this.nextBeat); this.nextBeat += 30 / station.bpm;
    }
  }
  schedule(station, beat, when) {
    const audio = this.audio, degree = [0, 3, 5, 2][Math.floor(beat / 16) % 4], root = station.root + degree;
    const frequency = midi => 440 * 2 ** ((midi - 69) / 12), note = [0, 2, 3, 5, 7, 10, 12];
    if (beat % 4 === 0) audio.tone(75, 0.14, 0.16, 'sine', when, 'music');
    if (beat % 4 === 2) audio.noise(0.09, 0.055, 1900, when, 'music');
    audio.noise(0.035, station.genre === 'Lo-fi' ? 0.014 : 0.025, 5200, when, 'music');
    if (beat % 2 === 0) audio.tone(frequency(root - 12), 0.25, 0.09, 'triangle', when, 'music');
    if (station.genre === 'Synthwave') audio.tone(frequency(root + 12 + note[(beat * 3 + Math.floor(beat / 16)) % note.length]), 0.18, 0.038, 'triangle', when, 'music');
    if (station.genre === 'Hip-hop' && beat % 8 === 5) audio.tone(frequency(root + 19), 0.13, 0.033, 'sine', when + 0.02, 'music');
    if (station.genre === 'Lo-fi' && beat % 8 === 0) for (const interval of [0, 3, 7, 10]) audio.tone(frequency(root + interval), 1.1, 0.022, 'sine', when, 'music');
    if (beat % 32 === 31 && this.rng.next() > 0.3) audio.noise(0.07, 0.025, 2500, when + 0.08, 'music');
  }
}
