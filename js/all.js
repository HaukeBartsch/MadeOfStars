import * as three from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Volume } from './World/Volume.js';
import {World} from "./World/World.js";

// volume image


function main() {
    console.log("Document is ready. Initializing scene...");

    var volumeImage = new Volume('channel_44.png');

    volumeImage.addEventListener('loaded', (event) => {
        console.log("Volume image loaded with slices: " + event.detail.slices);
        const sceneContainer = document.getElementById('scene-container');
        const world = new World(sceneContainer, volumeImage);
        world.start();
    });
}

main();