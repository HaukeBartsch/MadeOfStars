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
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Resizer } from "./Resizer.js";
//import Stats from './stats.min.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import * as dat from 'dat.gui'
const gui = new dat.GUI();
gui.domElement.id = "gui";

import { Agents } from './Agents.js';
import { Hunter } from './Hunter.js';

let scene, camera, renderer;
let composer;


let updatables;
let clock, stats;

class World{
    constructor(container, volumeImage) {
        updatables = [];
        // Scene
        scene = new Scene();
        const loader = new TextureLoader();
        let backgroundTexture = loader.load('https://raw.githubusercontent.com/dekrvch/Floids/main/src/assets/background.svg');
        scene.background = backgroundTexture;
        // Camera
        camera = new PerspectiveCamera(
            50, // fov = Field Of View
            1, // aspect ratio (dummy value)
            0.1, // near clipping plane
            100, // far clipping plane
        );
        //camera.position.set(0, 0, 2.2);
        camera.position.set(0, 0, 0);
        camera.lookAt(new Vector3(0, 0, 0));
        camera.up.set(0, 1, 0); // set the up direction of

        // Renderer
        renderer = new WebGLRenderer({ antialias: true,  alpha: true });

        container.append(renderer.domElement);
        // Orbit Controls
        const controls = new OrbitControls(camera, container)
        controls.enableDamping = false;
        controls.dampingFactor = 0.001;
        controls.enableZoom = true;
        controls.enablePan = false;
        controls.quickVec = new Vector3;
        let yAxis = new Vector3(0, 1, 0);
        controls.tick = () => {
            controls.update();
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
        scene.add(cube)

        // Resizer
        const resizer = new Resizer(container, camera, renderer);

        // Objects
        let agents = new Agents(2000);
        window.addEventListener("resize", _ => {    agents.uniforms.aspect.value = resizer.aspect   });
        let hunter = new Hunter();
        agents.setHunter(hunter);
        agents.setVolume(volumeImage);
        updatables.push(agents, hunter);
        scene.add(agents.mesh, hunter.mesh);
        
        // GUI
        const firingFolder = gui.addFolder('Firing')
        firingFolder.add(agents, 'FIRE_CYCLE', 0.5, 5).step(0.1).name("Cycle");
        firingFolder.add(agents, 'NUDGE_FACTOR', 0, 0.03).step(0.003).name("Nudging");
        firingFolder.add(agents.uniforms.fireR2, 'value', 0, 0.006).step(0.0001).name("Body fire");
        firingFolder.add(agents.uniforms.fireR1, 'value', 0, 0.06).step(0.001).name("Diffused fire");
        const desyncButton = { desync:function(){  agents.desyncronize(); }};
        firingFolder.add(desyncButton,'desync').name("Desyncronize");
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