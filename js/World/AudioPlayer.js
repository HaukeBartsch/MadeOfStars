const pentatonicIntervals = [0, 2, 4, 7, 9]; // semitones in pentatonic scale
const rootFreq = 392;

class AudioPlayer {
    constructor(agents) {
        this.agents = agents
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.isPlaying = false;
        this.timeoutId = null;
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.scheduleNextNote();
    }

    stop() {
        this.isPlaying = false;
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
    }


    scheduleNextNote() {
        if (!this.isPlaying) return;

        this.playNote();

        const bpm = this.agents.BPM;
        const intervalMs = (60 / bpm) * 1000;


        this.timeoutId = setTimeout(() => this.scheduleNextNote(), intervalMs);
    }


    playNote() {

        const spectrum = this.generateSpectrum(this.agents);
        this.resumeAudioContext();
        this.playSpectrum(spectrum, this.agents.BPM);
    }

    resumeAudioContext() {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    getPentatonicFreq(i) {
        // cycle through pentatonic intervals every 5 notes
        let octave = Math.floor(i / pentatonicIntervals.length);
        let scaleDegree = pentatonicIntervals[i % pentatonicIntervals.length];
        let semitones = octave * 12 + scaleDegree;

        return rootFreq * Math.pow(2, semitones / 12);
    }

    playSpectrum(spectrum, bpm) {
        let now = this.audioCtx.currentTime;

        spectrum.forEach((amplitude, i) => {
            let adjustedNow = now + i * 0.01
            if (amplitude < 0.01) return;
            let filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000, adjustedNow);
            
            let osc = this.audioCtx.createOscillator();
            let gain = this.audioCtx.createGain();

            let freq = this.getPentatonicFreq(i);
            osc.frequency.value = freq;
            osc.type = 'sine'

            let noteDuration = 60 / bpm;
            let releaseTime = 0.05;

            let baseAmp = amplitude * 0.05;
            let peakAmp = amplitude * 0.15;

            gain.gain.setValueAtTime(baseAmp, adjustedNow);
            gain.gain.linearRampToValueAtTime(peakAmp, adjustedNow + noteDuration / 2);
            gain.gain.linearRampToValueAtTime(baseAmp, adjustedNow + noteDuration - releaseTime);
            gain.gain.linearRampToValueAtTime(0, adjustedNow + noteDuration);

            osc.connect(gain).connect(filter).connect(this.audioCtx.destination);
            osc.start(adjustedNow);
            osc.stop(adjustedNow + noteDuration-0.05);
        });
    }

    generateSpectrum(agents, numBands = 64) {
        const positions = agents.posArray;
        const velocities = agents.velArray;
        // The clock array codes the relative phase of all particles relative to the cycle - when they light up.
        const clockArray = agents.clockArray;
        // The grid encodes for each voxel how many neighbors there are in a given maximum distance. This
        // can be used to estimate how many clusters are present in the data. This should change with each channel.
        const grid = agents.grid;
        const bpm = agents.BPM;

        let spectrum = new Array(numBands).fill(0);
        let count = positions.length / 3;

        let neighborsPerID = grid.getDistancesSq(positions, /* VISIBLE_RADIUS */ 0.15, this.USE_GRID);

        for (let i = 0; i < count; i++) {
            let x = positions[i * 3];
            let y = positions[i * 3 + 1];
            let z = positions[i * 3 + 2];

            let vx = velocities[i * 3];
            let vy = velocities[i * 3 + 1];
            let vz = velocities[i * 3 + 2];

            let ns = [...neighborsPerID[i].keys()].length;

            let posMag = Math.sqrt(x * x + y * y + z * z );
            let velMag = Math.sqrt(vx * vx + vy * vy + vz * vz);

            let energy = posMag * velMag + (0.001 * ns);

            let band = Math.floor((energy % 1) * numBands);

            spectrum[band] += energy;
        }

        let max = Math.max(...spectrum);
        if (max === 0) return spectrum;

        return spectrum.map(val => val / max);
    }
}
export { AudioPlayer };