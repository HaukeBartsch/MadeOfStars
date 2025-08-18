const intervals = [0, 2, 4, 7, 9]; // semitones in pentatonic scale
// alternative intervals
//const intervals = [0, 4, 7]; // semitones in major arpeggio
//const intervals = [0]; // one note
//const intervals = [0, 5, 7]; // semitones in major arpeggio
const rootFreq = 30;
const DURATION_FACTORS = {
  position:   1.0,
  velocity:   0.5,
  neighborhood: 0.1,
  // …you can add more sources here without touching the logic
};

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
        let numBands = 256;
        if (this.agents.enableChannel1)
            if (this.usePos)
                spectrums.push(this.generateSpectrum(this.agents, 0, numBands, 'position'));
            if (this.useVel)
                spectrums.push(this.generateSpectrum(this.agents, 0, numBands, 'velocity'));
            if (this.useNb)
                spectrums.push(this.generateSpectrum(this.agents, 0, numBands, 'neighborhood'));
        if (this.agents.enableChannel2)
            if (this.usePos)
                //spectrums.push(this.generateSpectrum(this.agents, 1, numBands, 'position'));
            if (this.useVel)
                //spectrums.push(this.generateSpectrum(this.agents, 1, numBands, 'velocity'));
            if (this.useNb)
                //spectrums.push(this.generateSpectrum(this.agents, 1, numBands, 'neighborhood'));
        if (this.agents.enableChannel3)
            if (this.usePos)
                //spectrums.push(this.generateSpectrum(this.agents, 2, numBands, 'position'));
            if (this.useVel)    
                //spectrums.push(this.generateSpectrum(this.agents, 2, numBands, 'velocity'));
            if (this.useNb)
                //spectrums.push(this.generateSpectrum(this.agents, 2, numBands, 'neighborhood'));
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
        const MAX_OCTAVE = 3;
        const octave  = Math.min(
            Math.floor(i / intervals.length),
            MAX_OCTAVE
        );
        let scaleDegree = intervals[i % intervals.length];
        let semitones = octave * 12 + scaleDegree;

        return rootFreq * Math.pow(2, semitones / 12);
    }

    playSpectrum(noteData, bpm, delay) {
        let now = this.audioCtx.currentTime;
        let spectrum = noteData[0];
        let noteDurationFactor = noteData[1];
        let noteType = noteData[2];
        spectrum.forEach((amplitude, i) => {
            let adjustedNow = now + i * 0.0001;
            if (amplitude < 0.01) return;

            let osc = this.audioCtx.createOscillator();
            
            let freq = this.getPentatonicFreq(i);
            osc.frequency.value = freq;
            osc.type = 'triangle'
            
            let noteDuration = (60 / bpm)*noteDurationFactor; // would need to get shorter if we play more notes
            let gain = this.audioCtx.createGain();
            
            if (noteType == 'wobble') {
                let attackTime = 0.00;
                let baseAmp = amplitude * 0.05;
                if (noteDurationFactor <= 0.1)
                    baseAmp = amplitude * 0.8
                let peakAmp = amplitude * 0.15;
                gain.gain.setValueAtTime(0.0, adjustedNow)
                //gain.gain.setValueAtTime(baseAmp, adjustedNow + attackTime);
                gain.gain.linearRampToValueAtTime(peakAmp, adjustedNow + noteDuration / 2);
                gain.gain.linearRampToValueAtTime(0, adjustedNow + noteDuration);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
            } else if (noteType == 'percuss') {
                // delay effect
                let dryGain = this.audioCtx.createGain();
                let wetGain = this.audioCtx.createGain();
                dryGain.gain.value = 1.0;          // original note volume
                wetGain.gain.value = 0.3;          // echo volume

                let delay = this.audioCtx.createDelay();
                delay.delayTime.value = 0.3;
                
                let feedback = this.audioCtx.createGain();
                feedback.gain.value = 0.4;

                delay.connect(feedback);
                feedback.connect(delay);

                osc.connect(gain);

                let baseAmp = amplitude;
                let endAmp = 0.0;
                let attackTime = 0.03
                gain.gain.setValueAtTime(0.0, adjustedNow);
                gain.gain.setValueAtTime(baseAmp, adjustedNow+attackTime);
                gain.gain.linearRampToValueAtTime(endAmp, adjustedNow + noteDuration - 0.01);
                
                gain.connect(dryGain);
                gain.connect(delay);

                delay.connect(wetGain);

                dryGain.connect(this.audioCtx.destination);
                wetGain.connect(this.audioCtx.destination);

            } else if (noteType == 'flat') {
                let attackTime = 0.05;
                let baseAmp = amplitude;
                if (noteDurationFactor <= 0.1)
                    baseAmp = amplitude * 0.8
                let peakAmp = amplitude * 0.15;
                gain.gain.setValueAtTime(0.0, adjustedNow)
                gain.gain.setValueAtTime(baseAmp, adjustedNow + attackTime);
                gain.gain.linearRampToValueAtTime(peakAmp, adjustedNow + noteDuration / 2);
                gain.gain.linearRampToValueAtTime(0, adjustedNow + noteDuration);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
            };
            osc.start(adjustedNow);
            osc.stop(adjustedNow + noteDuration);
        });
    }

    // channel = -1 is all channel
    // we can generate many spectra at once (by component and by channel) can those playback in time?
    // each tone would have to be shorter
    generateSpectrum(agents, channel = -1, numBands = 64, energy_source='position') {
        // energy source can be position, velocity, or magnitude
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
            let energy01 = (posMag);
            let energy02 = (velMag);
            //let energy03 = (cs);
            let energy04 = (ns);
            let energy04_normalized = Math.min(energy04 / this.agents.count, 1);

            let band01 = numBands - 1 - Math.floor((energy01 % 1) * numBands);
            let band02 = numBands - 1 - Math.floor((energy02 % 1) * numBands);
            //let band03 = Math.floor((energy03 % 1) * numBands);
            let band04 = numBands - 1 - Math.floor((energy04 % 1) * numBands);

            if (energy_source == 'position')
                spectrum[band01] += energy01;
            if (energy_source == 'velocity')
                spectrum[band02] += energy02;
            //spectrum[band03] += energy03;
            if (energy_source == 'neighborhood')
                spectrum[band04] += energy04;
        }

        const noteDurationFactor = DURATION_FACTORS[energy_source];
        let max = Math.max(...spectrum);
        if (max === 0) return spectrum;
        let noteType = ''
        if (noteDurationFactor == 1.0) {
            noteType = 'wobble';
        } else if (noteDurationFactor == 0.5) {
            noteType = 'flat';
        } else if (noteDurationFactor == 0.1)
            noteType = 'percuss'
        return [spectrum.map(val => val / max), noteDurationFactor, noteType];
    }
    setEnergyID(on=[TRUE,TRUE,TRUE]) {
        this.usePos = on[0];
        this.useVel = on[1];
        this.useNb = on[2];
    }
}
export { AudioPlayer };