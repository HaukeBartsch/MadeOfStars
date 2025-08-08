//import { Vector3 } from 'three';

class Vector3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

self.onmessage = (e) => {
    
    self.pixels = e.data.pixels;
    self.tilewidth = e.data.tilewidth;
    self.tileheight = e.data.tileheight;
    self.numSlices = e.data.numSlices;
    self.canvas_width = e.data.canvas_width;
    self.canvas_height = e.data.canvas_height;
    self.voxelSize = e.data.voxelSize;
    self.positionOffset = e.data.positionOffset;
    self.name = e.data.name;
    
    //self.voxelSize = new Vector3(1 / self.tilewidth, 1 / self.tileheight, 1 / self.tileheight);
    //self.positionOffset = new Vector3(-(self.voxelSize.x * self.tilewidth)/2.0, -(self.voxelSize.y * self.tileheight)/2.0, -(self.voxelSize.z * this.numSlices)/2.0); // offset to center the volume in the unit cube
    
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
    
    console.log("Message received from main script");
    console.log("Posting message back to main script");
    // don't use the gradientField afterwords here anymore, its back to the main thread
    postMessage(self.gradientField, [self.gradientField.buffer]); // send the gradient field back to the main thread
};

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