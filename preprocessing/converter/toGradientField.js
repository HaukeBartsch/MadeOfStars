const { Worker } = require('worker_threads');
const { Volume } = require('./Volume.mjs');
const fs = require('fs');
const PNG = require('pngjs').PNG;

// run with 
// node toGradientField.js ../../structure/channel_44.png ../../structure/gradient_44.bin
// gzip gradient_44.bin
// (output : gradient_44.bin.gz, could be compressed as each channel is full float, float16 might be fine)

class Vector3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

let input = "";
let output = "";
process.argv.forEach((val, index) => {
    if (index == 2)
        input = val;
    if (index == 3)
        output = val;
})

if (input == "") {
    console.log("Error: no argument image provided");
    exit(-1);
}

if (output == "") {
    console.log("Error: no argument output provided");
    exit(-1);
}

console.log("processing: " + input + " write to " + output);
var self = {}; // emulate the environment inside the work thread


self.getValue = function getValue(slice, x, y) {
    if (slice < 0 || slice >= self.numSlices || y < 0 || y >= self.tilewidth || x < 0 || x >= self.tileheight) {
        //console.warn("Out of bounds in getValue:", slice, x, y);
        return 0;
    }
    self.tilePerRow = 14;
    // mosaic format, we are at index i,j in the mosaic
    var j = Math.trunc(slice / self.tilePerRow);
    var i = slice - (j * self.tilePerRow);
    // calculate the x and y position in the mosaic
    var mosaicX = (i * self.tilewidth) + x;
    var mosaicY = (j * self.tileheight) + y;
    // get the value from the x and y position in the slice
    var value = self.pixels[(mosaicX + (mosaicY * self.canvas_width)) * 4]; // we only look at one of the channels (should be grayscale)
    if (value == null)
        return 0; // should never happen
    return value; 
};


self.updateGradient = function updateGradient() {
    // Each gradient is a Vector3, so we need 3 floats per voxel
    self.gradientField = new Float32Array(self.numSlices * self.tilewidth * self.tileheight * 3);
    
    // Helper to get/set 3D index in 1D array for gradient
    const gradIndex = (slice, y, x) => (slice * self.tilewidth * self.tileheight + y * self.tileheight + x) * 3;
    
    let maxGradient = 0;
    for (let slice = 0; slice < self.numSlices; slice++) {
        for (let y = 0; y < self.tilewidth; y++) {
            for (let x = 0; x < self.tileheight; x++) {
                let dx = self.getValue(slice, x + 1, y) - self.getValue(slice, x - 1, y);
                let dy = self.getValue(slice, x, y + 1) - self.getValue(slice, x, y - 1);
                let dz = self.getValue(slice + 1, x, y) - self.getValue(slice - 1, x, y);
                let gradientMagnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (gradientMagnitude > maxGradient) {
                    maxGradient = gradientMagnitude;
                }
                const idx = gradIndex(slice, y, x);
                self.gradientField[idx] = dx;
                self.gradientField[idx + 1] = dy;
                self.gradientField[idx + 2] = dz;
            }
        }
    }
    // Normalize gradients
    if (maxGradient > 0) {
        for (let slice = 0; slice < this.numSlices; slice++) {
            for (let y = 0; y < this.tilewidth; y++) {
                for (let x = 0; x < this.tileheight; x++) {
                    const idx = gradIndex(slice, y, x);
                    this.gradientField[idx] /= maxGradient;
                    this.gradientField[idx + 1] /= maxGradient;
                    this.gradientField[idx + 2] /= maxGradient;
                }
            }
        }
    }
}

function runWorkerTask(workerPath, data) {
    return new Promise((resolve, reject) => {
        
        // just run the content instead... cannot debug error right now
        self.pixels = data.pixels;        
        self.tilewidth = data.tilewidth;
        self.tileheight = data.tileheight;
        self.numSlices = data.numSlices;
        self.canvas_width = data.canvas_width;
        self.canvas_height = data.canvas_height;
        self.voxelSize = data.voxelSize;
        self.positionOffset = data.positionOffset;
        self.name = data.name;
        
        self.scalarField = new Float32Array(self.numSlices * self.tilewidth * self.tileheight);
        
        // Helper to get/set 3D index in 1D array
        self.scalarIndex = (slice, y, x) => slice * self.tilewidth * self.tileheight + y * self.tileheight + x;
        
        // Fill scalarField (we might not need that if we use the blurr below, it looks into getValue again)
        for (let slice = 0; slice < self.numSlices; slice++) {
            for (let y = 0; y < self.tilewidth; y++) {
                for (let x = 0; x < self.tileheight; x++) {
                    self.scalarField[self.scalarIndex(slice, y, x)] = self.getValue(slice, x, y);
                }
            }
        }
        self.scalarFieldCopy = new Float32Array(self.scalarField); // copy the scalar field for blurring
        
        // blurr the scalar field before computing the gradient
        for (let slice = 0; slice < self.numSlices; slice++) {
            //console.log("Blurring slice " + slice + " on " + self.name);
            for (let y = 0; y < self.tilewidth; y++) {
                for (let x = 0; x < self.tileheight; x++) {
                    let value = self.getValue(slice, x, y);
                    // average with neighbors
                    let sum = value;
                    let count = 1;
                    for (let dz = -1; dz <= 1; dz++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0 && dz === 0) continue; // skip self
                                let nx = x + dx;
                                let ny = y + dy;
                                let nz = slice + dz;
                                if (nx >= 0 && nx < self.tilewidth && ny >= 0 && ny < self.tileheight && nz >= 0 && nz < self.numSlices) {
                                    sum += self.scalarFieldCopy[self.scalarIndex(nz, ny, nx)];
                                    count++;
                                }
                            }
                        }
                    }
                    self.scalarField[self.scalarIndex(slice, y, x)] = sum / count;
                }
            }
        }
        
        // we would like to compute the gradient for this scalar field
        self.updateGradient();
        resolve(self.gradientField);
        
        /*const loader = new Worker("./VolumeWebWorker.js");
        
        loader.postMessage(data);
        loader.on('message', (event) => {
            // is us still us?
        // this.gradientField = event.data;
        resolve(event.data);            
        loader.terminate();
        });
        loader.on('exit', (code) => {
            if (code !== 0)
        reject(new Error('Worker failed with ' + code));
        });
        loader.postMessage(data); */
    });
}


async function main() {
    // read the input image as a Uint8ClampedArray
    fs.createReadStream(input)
    .pipe(new PNG({
        filterType: 4
    }))
    .on('parsed', async function() {
        // Access image data: this.width, this.height, this.data (raw pixel data)
        console.log('Image dimensions:', this.width, 'x', this.height);
        
        // Example: Iterate over pixels (RGBA format)
        /*for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
        const idx = (this.width * y + x) << 2; // Calculate index for RGBA
        const red = this.data[idx];
        const green = this.data[idx + 1];
        const blue = this.data[idx + 2];
        const alpha = this.data[idx + 3];
        // Process pixel data
        }
        }*/
        
        this.tilewidth = 400;
        this.tileheight = 400;
        this.voxelSize = new Vector3(1 / this.tilewidth, 1 / this.tileheight, 1 / this.tileheight);
        this.positionOffset = new Vector3(-(this.voxelSize.x * this.tilewidth)/2.0, -(this.voxelSize.y * this.tileheight)/2.0, -(this.voxelSize.z * this.numSlices)/2.0); // offset to center the volume in the unit cube
        this.pixels = new Uint8ClampedArray(this.data, this.data.byteOffset, this.data.length);
        
        let job = {
            name: "image",
            pixels: this.pixels,
            tilewidth: this.tilewidth,
            tileheight: this.tileheight,
            canvas_width: this.width,
            canvas_height: this.height,
            voxelSize: this.voxelSize,
            positionOffset: this.positionOffset,
            numSlices: 14 * 14 // 196 slices
        };
        
        const result = await runWorkerTask("./VolumeWebWorker.js", job);
        console.log("got some data back!");        
        const buffer = Buffer.from(result.buffer);
        fs.writeFile(output, buffer, (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }
        console.log('Float32Array saved to ' + output);
    });
        
    })
    .on('error', function(err) {
        console.error('Error reading PNG:', err);
    });
    
    //this.addEventListener('loaded', (event) => {
        //    console.log("processing done..." + event.detail.slices);
    //});
}

main();