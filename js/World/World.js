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
    Quaternion
} from 'three';
import Magnify3d from 'https://esm.sh/magnify-3d';

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

let scene, camera, renderer;
let composer;


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
        let backgroundTexture = loader.load('js/assets/background_darker.svg');
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
        const cameraQuanternion = new Quaternion(config.qx ?? default_quaternion.qx,config.qy ?? default_quaternion.qy,config.qz ?? default_quaternion.qz,config.qw ?? default_quaternion.qw);
        camera.quaternion.copy(cameraQuanternion);

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
        const firingFolder = gui.addFolder('Firing')
        const fire_cycle_controller = firingFolder.add(agents, 'FIRE_CYCLE', 0, 60).step(0.1).name("Cycle");
        const bpm_controller = firingFolder.add(agents, 'BPM', 1, 200).step(1).name("BPM").onChange((value) => {
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
        firingFolder.add(agents.uniforms.fireR2, 'value', 0, 0.006).step(0.0001).name("Body fire");
        firingFolder.add(agents.uniforms.fireR1, 'value', 0, 0.06).step(0.001).name("Diffused fire");
        const desyncButton = { desync:function(){  agents.desyncronize(); }};
        firingFolder.add(desyncButton,'desync').name("Desyncronize");
        
        this.audioPlayer = new AudioPlayer(agents);
        this.audioPlayer.start();

        const audioFolder = gui.addFolder('Audio')
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
            selectedOption3: config.channelID3 // default channel is "CD4"
        }
        volumeFolder.add(channelValue, 'selectedOption', { "CD3": 0, "CD20": 1, "CD11b": 2, "CD11c": 3, "CD4": 4, "Catalase": 5, "Hoechst": 6 }).name("Channel (red)").onChange((value) => {
            agents.setVolume(volumeImages[value]);
            agents.channelID1 = parseInt(value);
        });
        volumeFolder.add(channelValue, 'selectedOption2', { "CD3": 0, "CD20": 1, "CD11b": 2, "CD11c": 3, "CD4": 4, "Catalase": 5, "Hoechst": 6 }).name("Channel (blue)").onChange((value) => {
            agents.setVolume2(volumeImages[value]);
            agents.channelID2 = parseInt(value);
        });
        volumeFolder.add(channelValue, 'selectedOption3', { "CD3": 0, "CD20": 1, "CD11b": 2, "CD11c": 3, "CD4": 4, "Catalase": 5, "Hoechst": 6 }).name("Channel (yellow)").onChange((value) => {
            agents.setVolume3(volumeImages[value]);
            agents.channelID3 = parseInt(value);
        });

        const channelOn = {
            selectedOption: config.enableChannel1 ?? true,
            selectedOption2: config.enableChannel2 ?? true,
            selectedOption3: config.enableChannel3 ?? false
        }
        const channelOnController = volumeFolder.add(channelOn, "selectedOption").name("red").onChange((value) => {
            agents.setChannelID([channelOn.selectedOption, channelOn.selectedOption2, channelOn.selectedOption3], true);
            agents.enableChannel1 = value;
        });
        const channelOnController2 = volumeFolder.add(channelOn, "selectedOption2").name("blue").onChange((value) => {
            agents.setChannelID([channelOn.selectedOption, channelOn.selectedOption2, channelOn.selectedOption3], true);
            agents.enableChannel2 = value;
        });
        const channelOnController3 = volumeFolder.add(channelOn, "selectedOption3").name("yellow").onChange((value) => {
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
                        
            // c.zoom = controls.target.distanceTo(camera.position);

            // convert to a URL
            const params = new URLSearchParams(c);
            const queryString = params.toString();

            copyStringToClipboard(window.location.href + "/?" + queryString);
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
    }
    start(){
        renderer.setAnimationLoop(_ => {
            this.tick();
            //renderer.render(scene, camera);
            composer.render();
            //stats.update();
        })
    }
    stop(){
        renderer.setAnimationLoop(null);
    }
    tick(){
        let delta = Math.min(clock.getDelta(), 0.05); //to prevent huge delta value after swithcing the tab
        let elapsed = clock.getElapsedTime();
        for (let object of updatables){
            object.tick(delta, elapsed);
        }
    }
}
export {World}