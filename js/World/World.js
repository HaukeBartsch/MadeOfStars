import {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    Color,
    Clock,
    Vector2,
    Vector3,
    TextureLoader,
    BoxGeometry,
    MeshBasicMaterial,
    Mesh,
    Quaternion,
    Euler
} from 'three';
//import Magnify3d from 'https://esm.sh/magnify-3d';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'
import { ArcballControls } from 'three/addons/controls/ArcballControls.js';
import { Resizer } from "./Resizer.js";
//import Stats from './stats.min.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as dat from 'dat.gui'
const gui = new dat.GUI();
gui.domElement.id = "gui";

import { AudioPlayer } from './AudioPlayer.js';
import { Agents } from './Agents.js';
import { Hunter } from './Hunter.js';
import { colors, col_names_db, closestColorName } from './Colors.js';

let scene, camera, renderer;
let composer;

// for a camera animation
let anim = {
    setup: function(camera, clock, targetPosition, targetQuaternion, targetUp) {
        this.startAnimationQuaternion = (new Quaternion()).copy(camera.quaternion);
        this.startAnimationTime = clock.getElapsedTime();
        this.animationDuration = 2.0; // 2 seconds
        // get the Euler target with: euler = camera.rotation.clone();
        this.targetAnimationQuaternion = targetQuaternion;
        this.targetAnimationPosition = targetPosition;
        this.targetUp = targetUp;
        this.cameraUp0 = camera.up.clone(); // default up vector
        //this.cameraZoom = camera.position.z; // default zoom
        this.cameraPos0 = camera.position.clone(); // default position
        console.log("Initial camera position: " + JSON.stringify(this.cameraPos0));
        console.log("Target quaternion: " + JSON.stringify(this.targetAnimationQuaternion));
        
        this.curQ = new Quaternion(); // current quaternion
    },
    update: function(camera, t) {

        camera.position.lerpVectors(this.cameraPos0, this.targetAnimationPosition, t);

        let a = this.startAnimationQuaternion.clone();
        let b = this.targetAnimationQuaternion.clone();
        this.curQ.slerpQuaternions(a, b, t);
        this.curQ.normalize();
        camera.quaternion.copy(this.curQ);

        camera.up.lerpVectors(this.cameraUp0, this.targetUp, t);
        // camera.quaternion.slerpQuaternions(this.startAnimationQuaternion, this.targetAnimationQuaternion, t);
        //camera.up.lerpVectors(this.cameraUp0, new Vector3(0, 1, 0), t);
        //controls.update();
    },
    startAnimationQuaternion: null, // camera.quaternion.clone();
    startAnimationTime: null, // clock.getElapsedTime();
    animationDuration: 2.0, // 2 seconds
    targetAnimationQuaternion: null, // new Quaternion(0, 0, 0, 1);
    cameraUp0: new Vector3(0, 1, 0), // default up vector,
    cameraPos0: new Vector3(0, 0, 2), // default position
    cameraZoom: 2.0 // default zoom
};

let updatables;
let clock, stats;

async function copyStringToClipboard(textToCopy) {
    try {
        await navigator.clipboard.writeText(textToCopy);
        console.log('Text successfully copied to clipboard');
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }
}

class World{
    constructor(container, volumeImages, config) {
        
        //var numberOfAgents = config.numAgents || 700;
        updatables = [];
        // Scene
        scene = new Scene();
        const loader = new TextureLoader();
        let backgroundTexture = loader.load('js/assets/background_dark.svg');
        scene.background = backgroundTexture;
        // Camera
        camera = new PerspectiveCamera(
            50, // fov = Field Of View
            1, // aspect ratio (dummy value)
            0.1, // near clipping plane
            100, // far clipping plane
        );
        //camera.position.set(0, 0, 2.2);
        // we don't need the zoom as its part of the position (for the perspective camera we are using)
        camera.position.set(config.posx ?? 0, config.posy ?? 0, config.posz ?? 2); // see the Resizer for the camera position
        //camera.lookAt(new Vector3(config.lookAtx ?? 0, config.lookAty ?? 0, config.lookAtz ?? 0));
        camera.up.set(0, 1, 0); // set the up direction of
        // default quaternion is
        var default_quaternion = camera.quaternion;
        var default_up = camera.up;
        
        // Renderer
        renderer = new WebGLRenderer({ antialias: true,  alpha: true });
        container.append(renderer.domElement);
        
        // Orbit Controls
        //const controls = new OrbitControls(camera, container)
        
        // Trackball Controls (does not work well, better to use either OrbitControls or ArcballControls)
        //const controls = new TrackballControls(camera, container);
        //controls.staticMoving = true; // to avoid jittering
        //controls.rotateSpeed = 10.0;
        
        // Arcball Controls
        const controls = new ArcballControls(camera, container);
        this.controls = controls; // provide a handle during animation
        controls.enableDamping = false;
        controls.dampingFactor = 0.1;
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.quickVec = new Vector3;
        let yAxis = new Vector3(0, 1, 0);
        controls.tick = () => {
            // Not needed if we use the ArcballControls - but for all other controls we need this
            //controls.update();
        }
        updatables.push(controls);
        // Clock
        clock = new Clock;
        // FPS meter
        //stats = new Stats();
        
        //stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
        //container.appendChild(stats.domElement);
        //stats.domElement.id = "stats";
        
        // no longer needed, its obvious where the center of the volume is for animations
        const geometry_cube = new BoxGeometry();
        const material_cube = new MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
        });
        
        const cube = new Mesh(geometry_cube, material_cube)
        //scene.add(cube)
        
        // Resizer
        const resizer = new Resizer(container, camera, renderer);
        camera.position.set(config.posx ?? 0, config.posy ?? 0, config.posz ?? 2); // see the Resizer for the camera position
        // camera.rotation.set(config.rotx ?? )
        const cameraQuanternion = new Quaternion(
            config.qx ?? default_quaternion.qx,
            config.qy ?? default_quaternion.qy,
            config.qz ?? default_quaternion.qz,
            config.qw ?? default_quaternion.qw);
        camera.quaternion.copy(cameraQuanternion);
        const up_vector = new Vector3(
            config.upx ?? default_up.x,
            config.upy ?? default_up.y,
            config.upz ?? default_up.z
        );
        camera.up.copy(up_vector);
        
        //camera.lookAt(new Vector3(config.lookAtx ?? 0, config.lookAty ?? 0, config.lookAtz ?? 0));
        controls.update();
        
        // Objects
        let agents = new Agents(config);
        window.addEventListener("resize", _ => { agents.uniforms.aspect.value = resizer.aspect });
        let hunter = new Hunter();
        agents.setHunter(hunter);
        
        agents.setVolume(volumeImages[config.channelID1]); // Hoechst
        agents.setVolume2(volumeImages[config.channelID2]); // Catalase
        agents.setVolume3(volumeImages[config.channelID3]); // Catalase
        updatables.push(agents, hunter);
        scene.add(agents.mesh, hunter.mesh);
        
        // GUI
        const firingFolder = gui.addFolder('Firing');
        gui.close();
        const fire_cycle_controller = firingFolder.add(agents, 'FIRE_CYCLE', 0, 60).step(0.1).name("Cycle");
        const bpm_controller = firingFolder.add(agents, 'BPM', 1, 1000).step(1).name("BPM").onChange((value) => {
            agents.FIRE_CYCLE = 60.0 / value;
            fire_cycle_controller.updateDisplay();
            // value = 60 / FIRE_CYCLE
            // FIRE_CYCLE = 60 / value
        });
        fire_cycle_controller.onChange((value) => {
            agents.BPM = 60 / value;
            bpm_controller.updateDisplay();
        });

        firingFolder.add(agents, 'NUDGE_FACTOR', 0, 0.03).step(0.003).name("Nudging");
        firingFolder.add(agents.uniforms.fireR2, 'value', 0, 0.01).step(0.00001).name("Body fire");
        firingFolder.add(agents.uniforms.fireR1, 'value', 0, 0.06).step(0.0001).name("Diffused fire");
        const desyncButton = { desync:function(){  agents.desyncronize(); }};
        firingFolder.add(desyncButton,'desync').name("Desyncronize");
        
        this.audioPlayer = new AudioPlayer(agents);
        //this.audioPlayer.start(); // this immediately starts the audio player, instead wait for user interaction, sound has to be switched on

        const audioFolder = gui.addFolder('Audio');
        const toggleSoundButton = { toggle_sound: (function(audioPlayer) {
            return function() {
                if (audioPlayer.isPlaying)
                    audioPlayer.stop();
                else
                    audioPlayer.start();
            };
        })(this.audioPlayer) };
        this.toggleAudioController = audioFolder.add(toggleSoundButton,'toggle_sound').name("Start Sound").onChange(() => {
            if (this.audioPlayer.isPlaying) {
                this.toggleAudioController.name("Start Sound");
            } else {
                this.toggleAudioController.name("Stop Sound");
            }

            //console.log("Toggle sound: " + value);
        });
        const energyOptions = {
            pos: true,
            vel: true,
            neighbors: true
        };

        // Handler to call setEnergyID with current values
        this.updateEnergy = () => {
            this.audioPlayer.setEnergyID([
                energyOptions.pos,
                energyOptions.vel,
                energyOptions.neighbors
            ], true);
        }
        // Add checkboxes to folder
        audioFolder.add(energyOptions, 'pos').name('pos').onChange(this.updateEnergy);
        audioFolder.add(energyOptions, 'vel').name('vel').onChange(this.updateEnergy);
        audioFolder.add(energyOptions, 'neighbors').name('neighbors').onChange(this.updateEnergy);
        this.updateEnergy();

        const flockingFolder = gui.addFolder('Flocking')
        flockingFolder.add(agents, 'DESIRED_SPEED', 0, 0.4).step(0.001).name("Speed");
        flockingFolder.add(agents, 'COHERE_FACTOR', 0, 10).step(0.1).name("Coherence");
        flockingFolder.add(agents, 'ALIGN_FACTOR', 0, 0.2).step(0.01).name("Alignment");
        flockingFolder.add(agents, 'AVOID_FACTOR', 0, 50).step(.1).name("Avoidance");
        //flockingFolder.add(agents, 'USE_GRID').name("Use grid");
        const hunterFolder = gui.addFolder('Hunter')
        hunterFolder.add(hunter, 'enable').name("Enable");
        hunterFolder.add(hunter, 'CHASE_FACTOR', 0, 0.8).step(0.1).name("Chasing");
        hunterFolder.add(agents, 'FLEE_FACTOR', 0, 10).step(0.1).name("Fleeing");
        hunterFolder.add(agents, 'CONFUSION_FACTOR', 0, 0.5).step(0.005).name("Confusion");

        const volumeFolder = gui.addFolder('Volume');
        volumeFolder.add(agents, 'GRADIENT_SCALER', 0, 10).step(0.001).name("Gradient scaling");
        //volumeFolder.add(this, 'CURRENT_VOLUME_INDEX', 0, volumeImages.length).step(1).name("Volume");
        //let world = this;
        //const changeVolumeButton = { changeVolume: function() { 
        //    agents.setVolume(volumeImages[world.CURRENT_VOLUME_INDEX]); 
        //}};
        //volumeFolder.add(changeVolumeButton, 'changeVolume').name("Change volume");
        
        const channelValue = {
            selectedOption: config.channelID1, // default channel is "Hoechst"
            selectedOption2: config.channelID2, // default channel is "Catalase"
            selectedOption3: config.channelID3, // default channel is "CD4"
            selectedColormap: null // we will store only the individual colors, not the colormap
        }
        const channelValueController1 = volumeFolder.add(channelValue, 'selectedOption', { "CD3": 0, "CD20": 1, "CD11b": 2, "CD11c": 3, "CD4": 4, "Catalase": 5, "Hoechst": 6 }).name("CH1 - " + closestColorName(agents.fireColor).replaceAll("_", " ")).onChange((value) => {
            agents.setVolume(volumeImages[value]);
            agents.channelID1 = parseInt(value);
        });
        const channelValueController2 = volumeFolder.add(channelValue, 'selectedOption2', { "CD3": 0, "CD20": 1, "CD11b": 2, "CD11c": 3, "CD4": 4, "Catalase": 5, "Hoechst": 6 }).name("CH2 - " + closestColorName(agents.fireColor2).replaceAll("_", " ")).onChange((value) => {
            agents.setVolume2(volumeImages[value]);
            agents.channelID2 = parseInt(value);
        });
        const channelValueController3 = volumeFolder.add(channelValue, 'selectedOption3', { "CD3": 0, "CD20": 1, "CD11b": 2, "CD11c": 3, "CD4": 4, "Catalase": 5, "Hoechst": 6 }).name("CH3 - " + closestColorName(agents.fireColor3).replaceAll("_", " ")).onChange((value) => {
            agents.setVolume3(volumeImages[value]);
            agents.channelID3 = parseInt(value);
        });

        // use a colormap for colors
        var cols = {};
        for (const c of Object.keys(colors)) {
            if (typeof colors[c][3] != "undefined") 
              cols[c] = c;
        }
        volumeFolder.add(channelValue, 'selectedColormap', cols).name("Colormaps").onChange((value) => {
            // new three colors now in config
            agents.fireColor = colors[value][3][0];
            agents.fireColor2 = colors[value][3][1];
            agents.fireColor3 = colors[value][3][2];
            agents.uniforms.fireColor.value = new Color(agents.fireColor);
            agents.uniforms.fireColor2.value = new Color(agents.fireColor2);
            agents.uniforms.fireColor3.value = new Color(agents.fireColor3);
            channelValueController1.name("CH1 - " + closestColorName(agents.fireColor).replaceAll("_", " "));
            channelValueController2.name("CH2 - " + closestColorName(agents.fireColor2).replaceAll("_", " "));
            channelValueController3.name("CH3 - " + closestColorName(agents.fireColor3).replaceAll("_", " "));
        });

        
        const channelOn = {
            selectedOption: config.enableChannel1 ?? true,
            selectedOption2: config.enableChannel2 ?? true,
            selectedOption3: config.enableChannel3 ?? false
        }
        const channelOnController = volumeFolder.add(channelOn, "selectedOption").name("CH1").onChange((value) => {
            agents.setChannelID([channelOn.selectedOption, channelOn.selectedOption2, channelOn.selectedOption3], true);
            agents.enableChannel1 = value;
        });
        const channelOnController2 = volumeFolder.add(channelOn, "selectedOption2").name("CH2").onChange((value) => {
            agents.setChannelID([channelOn.selectedOption, channelOn.selectedOption2, channelOn.selectedOption3], true);
            agents.enableChannel2 = value;
        });
        const channelOnController3 = volumeFolder.add(channelOn, "selectedOption3").name("CH3").onChange((value) => {
            agents.setChannelID([channelOn.selectedOption, channelOn.selectedOption2, channelOn.selectedOption3], true);
            agents.enableChannel3 = value;
        });
        
        const linkButton = { getLink: function(){  
            var c = agents.getConfig();
            // add the camera settings as well
            c.posx = camera.position.x;
            c.posy = camera.position.y;
            c.posz = camera.position.z;
            c.qx = camera.quaternion.x;
            c.qy = camera.quaternion.y;
            c.qz = camera.quaternion.z;
            c.qw = camera.quaternion.w;
            c.upx = camera.up.x;
            c.upy = camera.up.y;
            c.upz = camera.up.z;
            
            // c.zoom = controls.target.distanceTo(camera.position);
            
            // convert to a URL
            const params = new URLSearchParams(c);
            const queryString = params.toString();
            
            let url = new URL(window.location.href);
            url.search = ''; // remove the query string
            copyStringToClipboard(url.toString() + "?" + queryString);
        }};
        volumeFolder.add(linkButton,'getLink').name("Copy bookmark");
        
        
        //let textParam = {show: false};
        //let textCheckBox = gui.add(textParam, "show").name("Show Explanation").onChange((show) => {
            //    document.getElementById("text").style.visibility = show ? "visible" : "hidden";
        //    document.getElementById("text").style.height = show ? "auto" : "0";
        //    document.getElementById("signature").style.visibility = show ? "visible" : "hidden";
        //    document.getElementById("rotateMessage").style.visibility = show ? "hidden" : "visible";
        //});
        //textCheckBox.domElement.parentNode.parentNode.id = "textCheckBox";
        //Bloom pass
        const renderScene = new RenderPass( scene, camera );
        const bloomPass = new UnrealBloomPass(new Vector2( window.innerWidth, window.innerHeight ), 0.002, 0.003, 0.004 );
        composer = new EffectComposer( renderer );
        composer.addPass( renderScene );
        composer.addPass( bloomPass );

        // add some animations to the camera based on keypress events
        window.addEventListener("keydown", (event) => {
            if (event.key == "a") {
                // reset the camera to the default position
                anim.setup(this.controls.object, clock, new Vector3(0, 0, 1.2), new Quaternion(0, 0, 0, 2), new Vector3(0, 1, 0));
            } else if (event.key == "i") {
                // zoom in
                anim.setup(this.controls.object, clock, new Vector3(0, -1.2, 0), new Quaternion(1, 0, 0, 0.7), new Vector3(0, 0, 1));
            } else if (event.key == "1") {
                anim.setup(this.controls.object, clock, new Vector3(0.1184077458925482, 0.25066848923269364, 0.2918929200499662), new Quaternion(0, 0, 0, 1), new Vector3(0, 1, 0));
            }
        });

    }
    start(){
        renderer.setAnimationLoop(_ => {
            this.tick();
            //renderer.render(scene, camera);

            // animate the camera if we have a startAnimationQuaternion
            if (anim.startAnimationQuaternion && anim.targetAnimationQuaternion) {
                let elapsed = clock.getElapsedTime() - anim.startAnimationTime;
                if (elapsed < anim.animationDuration) {
                    anim.update(camera, elapsed / anim.animationDuration);
                    this.controls.update();
                } else {
                    // do the last update?
                    anim.update(camera, 1.0);
                    this.controls.update();
                    anim.startAnimationQuaternion = null;
                    anim.targetAnimationQuaternion = null;
                }

                /*if (elapsed < anim.animationDuration) {
                    let t = elapsed / anim.animationDuration;
                    camera.quaternion.slerpQuaternions(anim.startAnimationQuaternion, anim.targetAnimationQuaternion, t);
                    //camera.up.lerpVectors(camera.up, new Vector3(0, 1, 0), t);
                    //controls.update();
                } else {
                    // reset the animation
                    anim.startAnimationQuaternion = null;
                    anim.targetAnimationQuaternion = null;
                }*/
            }

            composer.render();
            //stats.update();
        })
    }
    stop(){
        renderer.setAnimationLoop(null);
    }
    tick(){
        let delta = Math.min(clock.getDelta(), 0.05); //to prevent huge delta value after switching the tab
        let elapsed = clock.getElapsedTime();
        for (let object of updatables){
            object.tick(delta, elapsed);
        }
    }
}
export {World}