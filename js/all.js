import * as three from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Volume } from './World/Volume.js';
import {World} from "./World/World.js";

// volume image
var numLoaded = 0;

window.mobileCheck = function() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};

async function main() {
    if (window.mobileCheck()) {
        alert("Due to memory requirements this demo might not work on mobile devices. Please try on a tablet/laptop or desktop computer.");
    }

    console.log("Document is ready. Initializing scene...");
    
    // use a config object that can be overwritten by the URL arguments
    var config = {
        numAgents: 700,
        channelID1: 5,
        channelID2: 6,
        channelID3: 4,
        enableChannel1: true,
        enableChannel2: true,
        enableChannel3: true,
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
        fireColor3: "#c450d5", // #c450d5, #b0b27f
        bodySize: 0.02,
        bodyOpacity: 0.2,
        fireR1: 0.002,
        fireR2: 0.0001,
        aspect: 1.0,
        posx: 0,
        posy: 0,
        posz: 2,
        qx: 0,
        qy: 0,
        qz: 1,
        qw: 1,
        mode: "default" // "Kurosawa" or "default"
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
    //var channels = ['channel_19.png', 'channel_27.png', 'channel_37.png', 'channel_42.png', 'channel_25.png', 'channel_59.png', 'channel_44.png'];
    var channels = ['gradient_19.bin.gz', 'gradient_27.bin.gz', 'gradient_37.bin.gz', 'gradient_42.bin.gz', 'gradient_25.bin.gz', 'gradient_59.bin.gz', 'gradient_44.bin.gz'];
    //var channels = ['large_gradient_19.bin.gz', 'large_gradient_27.bin.gz', 'large_gradient_37.bin.gz', 'large_gradient_42.bin.gz', 'large_gradient_25.bin.gz', 'large_gradient_59.bin.gz', 'large_gradient_44.bin.gz'];
    //var channels = ['channel_44.png' ];
    var volumes = [];
    
    const promises = [];
    channels.forEach(channel => {
        volumes.push(new Volume(channel));
        
        promises.push(new Promise((resolve) => {
            volumes[volumes.length -1].addEventListener('loaded', (event) => {
                console.log("gradient loaded for " + channel + ". Found " + event.detail.slices + " slices.");
                numLoaded++;
                var nl = document.getElementById("num-loaded");
                if (nl) {
                    nl.textContent = numLoaded;
                }
                resolve();
            });
        }));
    });
    
    await Promise.all(promises).then(() => {
        //jQuery('#messages').hide(); // hide the messages
        const sceneContainer = document.getElementById('scene-container');
        const world = new World(sceneContainer, volumes, config);
        world.start();
        // start fading out the messages
        const msg = document.getElementById('messages');
        // msg.style.display = 'none'; // hide the messages
        setTimeout(function() { 
            msg.classList.add('start_fade_out');
        }, 1000);
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