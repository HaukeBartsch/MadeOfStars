import * as three from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Volume } from './World/Volume.js';
import {World} from "./World/World.js";

// volume image


async function main() {
    console.log("Document is ready. Initializing scene...");

    // how many agents should we use?
    let numAgents = 700;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('stars'))
        numAgents = urlParams.get('stars');

    // list of channels
    // CD3 (19), CD20 (27), CD11b (37), CD4 (25) and Catalase (59) (plus Hoechst - 44)
    var channels = ['channel_19.png', 'channel_27.png', 'channel_37.png', 'channel_42.png', 'channel_25.png', 'channel_59.png', 'channel_44.png'];
    var channels = ['gradient_19.bin.gz', 'gradient_27.bin.gz', 'gradient_37.bin.gz', 'gradient_42.bin.gz', 'gradient_25.bin.gz', 'gradient_59.bin.gz', 'gradient_44.bin.gz'];
    //var channels = ['channel_44.png' ];
    var volumes = [];

    const promises = [];
    channels.forEach(channel => {
        volumes.push(new Volume(channel));

        promises.push(new Promise((resolve) => {
            volumes[volumes.length -1].addEventListener('loaded', (event) => {
                console.log("gradient loaded for " + channel + ". Found " + event.detail.slices + " slices.");
                resolve();
            });
        }));
    });

    await Promise.all(promises).then(() => {
        const msg = document.getElementById('messages');
        msg.style.display = 'none'; // hide the messages
        //jQuery('#messages').hide(); // hide the messages
        const sceneContainer = document.getElementById('scene-container');
        const world = new World(sceneContainer, volumes, numAgents);
        world.start();
    });

  /*  
    var volumeImage = new Volume('channel_44.png');

    volumeImage.addEventListener('loaded', (event) => {
        console.log("Volume image loaded with slices: " + event.detail.slices);
        const sceneContainer = document.getElementById('scene-container');
        const world = new World(sceneContainer, volumeImage);
        world.start();
    }); */
}

main();