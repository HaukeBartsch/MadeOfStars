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

        var spectrums = []; // on per channel enabled
        if (this.agents.enableChannel1)
            spectrums.push(this.generateSpectrum(this.agents, 0));
        if (this.agents.enableChannel2)
            spectrums.push(this.generateSpectrum(this.agents, 1));
        if (this.agents.enableChannel3)
            spectrums.push(this.generateSpectrum(this.agents, 2));
        this.resumeAudioContext();
        // offset the three sounds
        for (var i = 0; i < spectrums.length; i++)
            this.playSpectrum(spectrums[i], this.agents.BPM, this.agents.FIRE_CYCLE/spectrums.length * i);
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

    playSpectrum(spectrum, bpm, delay) {
        let now = this.audioCtx.currentTime;

        spectrum.forEach((amplitude, i) => {
            let adjustedNow = now + i * 0.01 + delay;
            if (amplitude < 0.01) return;
            let filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000, adjustedNow);
            
            let osc = this.audioCtx.createOscillator();
            let gain = this.audioCtx.createGain();

            let freq = this.getPentatonicFreq(i);
            osc.frequency.value = freq;
            osc.type = 'sine'

            let noteDuration = 60 / bpm; // would need to get shorter if we play more notes
            noteDuration /= 3.0;
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

    // channel = -1 is all channel
    // we can generate many spectra at once (by component and by channel) can those playback in time?
    // each tone would have to be shorter
    generateSpectrum(agents, channel = -1, numBands = 64) {
        const positions = agents.posArray;
        const velocities = agents.velArray;
        // The clock array codes the relative phase of all particles relative to the cycle - when they light up.
        const clockArray = agents.clockArray;
        // The grid encodes for each voxel how many neighbors there are in a given maximum distance. This
        // can be used to estimate how many clusters are present in the data. This should change with each channel.
        const grid = agents.grid;
        const bpm = agents.BPM;
        // the channel each point has been assigned to. (note a channel can be switch off, no point will be assigned to such a channel)
        const channelArray = agents.channelArray;

        let spectrum = new Array(numBands).fill(0);
        let count = positions.length / 3;

        let neighborsPerID = grid.getDistancesSq(positions, /* VISIBLE_RADIUS */ 0.15, this.USE_GRID);

        for (let i = 0; i < count; i++) {
            if (channel != -1 && channelArray[i] != channel)
                continue; 

            let x = positions[i * 3];
            let y = positions[i * 3 + 1];
            let z = positions[i * 3 + 2];

            let vx = velocities[i * 3];
            let vy = velocities[i * 3 + 1];
            let vz = velocities[i * 3 + 2];

            let ns = ([...neighborsPerID[i].keys()].length / count) % 1;

            let cs = (clockArray[i] / (60 / bpm)) % 1; // now from 0 to 1

            let posMag = Math.sqrt(x * x + y * y + z * z );
            let velMag = Math.sqrt(vx * vx + vy * vy + vz * vz);

            // one component based on distance and speed
            // one component based on average clustering (per channel)
            // one component based on synchronized firing
            // let energy = ((posMag * velMag) + (ns) + (cs)) / 3.0;
            let energy01 = (posMag * velMag);
            let energy02 = (ns);
            let energy03 = (cs);

            let band01 = Math.floor((energy01 % 1) * numBands);
            let band02 = Math.floor((energy02 % 1) * numBands);
            let band03 = Math.floor((energy03 % 1) * numBands);

            spectrum[band01] += energy01;
            spectrum[band02] += energy02;
            spectrum[band03] += energy03;
        }

        let max = Math.max(...spectrum);
        if (max === 0) return spectrum;

        return spectrum.map(val => val / max);
    }
}
export { AudioPlayer };