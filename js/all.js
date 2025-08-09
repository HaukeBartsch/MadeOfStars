import * as three from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Volume } from './World/Volume.js';
import {World} from "./World/World.js";

// volume image


async function main() {
    console.log("Document is ready. Initializing scene...");
    
    // use a config object that can be overwritten by the URL arguments
    var config = {
        numAgents: 700,
        channelID1: 5,
        channelID2: 6,
        channelID3: 4,
        enableChannel1: true,
        enableChannel2: true,
        enableChannel3: false,
        DESIRED_SPEED: 0.001,
        TAU_SPEED: 0.01,
        FIRE_CYCLE: 3,
        NUDGE_FACTOR: 0.003,
        NUDGE_LIMIT: 3,
        CONFUSION_FACTOR: 0.2,
        VISIBLE_RADIUS: 0.15,
        PROTECTED_RADIUS: 0.05,
        FLEE_RADIUS: 0.30,
        HABITAT_RADIUS: 1.8,
        USE_GRID: true,
        ALIGN_FACTOR: 0.02,
        COHERE_FACTOR: 0,
        AVOID_FACTOR: 0.1,
        FLEE_FACTOR: 3.01,
        HABITAT_FACTOR: 0.1,
        GRADIENT_SCALER: 0.5,
        bodyColor: "#747474",
        fireColor: "#ff747b",
        fireColor2: "#7474ff",
        fireColor3: "#b3e2cd",
        bodySize: 0.02,
        bodyOpacity: 0.2,
        fireR1: 0.002,
        fireR2: 0.0001,
        aspect: 1.0,
        posx: 0,
        posy: 0,
        posz: 2,
        lookAtx: 0,
        lookAty: 0,
        lookAtz: 1
    };
    var requiredInteger = [ "channelID1","channelID2","channelID3", "numAgents" ];

    const urlParams = new URLSearchParams(window.location.search);
    Object.keys(config).forEach(function(key) {
        if (urlParams.has(key)) {
            if ( key in requiredInteger ) {
                config[key] = parseInt(urlParams.get(key));
                return;
            }
            if (typeof config[key] == "number") {
                // floating point because we did int above already
                config[key] = parseFloat(urlParams.get(key));
                return;
            }
            if ( typeof config[key] == "boolean") {
                config[key] = urlParams.get(key) == "true" ? true : false;
                return;
            }
            if ( typeof config[key] == "string" ) {
                config[key] = "" + urlParams.get(key);
                return;
            }
        }
    });

    
    // how many agents should we use?
    if (urlParams.has('stars'))
        config.numAgents = parseInt(urlParams.get('stars')); // this is another numAgents alias

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
        const world = new World(sceneContainer, volumes, config);
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