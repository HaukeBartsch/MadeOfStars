import { Vector3 } from 'three';

// TODO: rewrite this to work in the background (WebWorker) to allow for animations while loading


class Volume extends EventTarget {
    constructor(image_file_name, CB) {
        super();
        this.volumeData = new Image();
        this.volumeData.src = image_file_name;
        this.volumeData.onload = () => {
            console.log("Volume data loaded successfully.");
            
            this.canvas = document.createElement('canvas');
            this.canvas.width = this.volumeData.width;
            this.canvas.height = this.volumeData.height;
            const ctx = this.canvas.getContext('2d');
            
            ctx.drawImage(this.volumeData, 0, 0);
            
            this.imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            this.pixels = this.imageData.data; // This is the Uint8ClampedArray
            
            this.tilewidth = this.volumeData.width / 14;
            this.tileheight = this.volumeData.height / 14;
            this.numSlices = 14 * 14; // 196 slices
            
            // we need to position our gradient field in the volume. flock values currently seem to be in -1..1 range
            this.voxelSize = new Vector3(1 / this.tilewidth, 1 / this.tileheight, 1 / this.tileheight);
            this.positionOffset = new Vector3(-(this.voxelSize.x * this.tilewidth)/2.0, -(this.voxelSize.y * this.tileheight)/2.0, -(this.voxelSize.z * this.numSlices)/2.0); // offset to center the volume in the unit cube
            
            // here we can create a webworker to import the pixel data and to compute the gradient field
            if (window.Worker) {
                
                // our web worker code is many times slower than the main thread, maybe chrome is not doing the same optimizations as in the main thread?
                (function (us) {
                    let loader = new Worker("./js/World/VolumeWebWorker.js");
                    loader.postMessage({
                        name: us.volumeData.src,
                        pixels: us.pixels,
                        tilewidth: us.volumeData.width / 14,
                        tileheight: us.volumeData.height / 14,
                        canvas_width: us.canvas.width,
                        canvas_height: us.canvas.height,
                        voxelSize: us.voxelSize,
                        positionOffset: us.positionOffset,
                        numSlices: 14 * 14 // 196 slices
                    });
                    loader.onmessage = (event) => {
                        // is us still us?
                        us.gradientField = event.data;
                        
                        var event = new CustomEvent('loaded', { detail: { slices: us.numSlices } });
                        us.dispatchEvent(event);
                    }
                })(this);
            } else {
                
                this.scalarField = new Float32Array(this.numSlices * this.tilewidth * this.tileheight);
                
                // Helper to get/set 3D index in 1D array
                this.scalarIndex = (slice, y, x) => slice * this.tilewidth * this.tileheight + y * this.tileheight + x;
                
                // Fill scalarField
                for (let slice = 0; slice < this.numSlices; slice++) {
                    for (let y = 0; y < this.tilewidth; y++) {
                        for (let x = 0; x < this.tileheight; x++) {
                            this.scalarField[this.scalarIndex(slice, y, x)] = this.getValue(slice, x, y);
                        }
                    }
                }

                this.scalarFieldCopy = new Float32Array(this.scalarField); // copy the scalar field for blurring
                
                // blurr the scalar field before computing the gradient
                for (let slice = 0; slice < this.numSlices; slice++) {
                    for (let y = 0; y < this.tilewidth; y++) {
                        for (let x = 0; x < this.tileheight; x++) {
                            let value = this.getValue(slice, x, y);
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
                                        if (nx >= 0 && nx < this.tilewidth && ny >= 0 && ny < this.tileheight && nz >= 0 && nz < this.numSlices) {
                                            sum += this.scalarFieldCopy[this.scalarIndex(nz, ny, nx)];
                                            count++;
                                        }
                                    }
                                }
                            }
                            this.scalarField[this.scalarIndex(slice, y, x)] = sum / count;
                        }
                    }
                }
                delete this.scalarFieldCopy; // we don't need the copy anymore
                /*            this.scalarField = Array.from({ length: this.numSlices }, () =>
                    Array.from({ length: this.tilewidth }, () =>
                        Array.from({ length: this.tileheight }, () => 0)
                )
                );
                for (let slice = 0; slice < this.numSlices; slice++) {
                // could be sped up if we can assign like in matlab
                for (let y = 0; y < this.tilewidth; y++) {
                for (let x = 0; x < this.tileheight; x++) {
                this.scalarField[slice][y][x] = this.getValue(slice, x, y);
                }
                }
                } */
                
                // we would like to compute the gradient for this scalar field
                this.updateGradient();
                
                // we don't need the memory anymore
                delete this.pixels;
                delete this.scalarFieldCopy;

                var event = new CustomEvent('loaded', { detail: { slices: this.numSlices } });
                this.dispatchEvent(event);
            }
        };
    }
    // compute a gradient field for the scalar field this.pixels
    updateGradient() {
        // Each gradient is a Vector3, so we need 3 floats per voxel
        this.gradientField = new Float32Array(this.numSlices * this.tilewidth * this.tileheight * 3);
        
        // Helper to get/set 3D index in 1D array for gradient
        const gradIndex = (slice, y, x) => (slice * this.tilewidth * this.tileheight + y * this.tileheight + x) * 3;
        
        let maxGradient = 0;
        for (let slice = 0; slice < this.numSlices; slice++) {
            for (let y = 0; y < this.tilewidth; y++) {
                for (let x = 0; x < this.tileheight; x++) {
                    let dx = this.getValue(slice, x + 1, y) - this.getValue(slice, x - 1, y);
                    let dy = this.getValue(slice, x, y + 1) - this.getValue(slice, x, y - 1);
                    let dz = this.getValue(slice + 1, x, y) - this.getValue(slice - 1, x, y);
                    let gradientMagnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (gradientMagnitude > maxGradient) {
                        maxGradient = gradientMagnitude;
                    }
                    const idx = gradIndex(slice, y, x);
                    this.gradientField[idx] = dx;
                    this.gradientField[idx + 1] = dy;
                    this.gradientField[idx + 2] = dz;
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
        
        /*        this.gradientField = Array.from({ length: this.numSlices }, () =>
            Array.from({ length: this.tilewidth }, () =>
                Array.from({ length: this.tileheight }, () => 
                    new Vector3(0, 0, 0)
        )
        )
        );
        let maxGradient = 0;
        for (let slice = 0; slice < this.numSlices; slice++) {
        for (let y = 0; y < this.tilewidth; y++) {
        for (let x = 0; x < this.tileheight; x++) {
        let dx = this.getValue(slice, x + 1, y) - this.getValue(slice, x - 1, y);
        let dy = this.getValue(slice, x, y + 1) - this.getValue(slice, x, y - 1);
        let dz = this.getValue(slice + 1, x, y) - this.getValue(slice - 1, x, y);
        let gradientMagnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (gradientMagnitude > maxGradient) {
        maxGradient = gradientMagnitude;
        }
        this.gradientField[slice][y][x].set(dx, dy, dz);
        }
        }
        }
        // scale the gradient field based on the max gradient value
        if (maxGradient > 0) {
        for (let slice = 0; slice < this.numSlices; slice++) {
        for (let y = 0; y < this.tilewidth; y++) {
        for (let x = 0; x < this.tileheight; x++) {
        let current = this.gradientField[slice][y][x];
        this.gradientField[slice][y][x].set(current.x/maxGradient, current.y/maxGradient, current.z/maxGradient);
        }
        }
        }
        } */
    }
    getLoc2Idx(loc) {
        // loc is a Vector3 in range [-0.5..0.5, -0.5..0.5, -0.5..0.5]
        // return the index [slice, x, y] in the scalar field
        let x = Math.floor((loc.x - this.positionOffset.x) / (this.voxelSize.x) + 0.5);
        let y = Math.floor((loc.y - this.positionOffset.y) / (this.voxelSize.y) + 0.5);
        let slice = Math.floor((loc.z - this.positionOffset.z) / (this.voxelSize.z) + 0.5);
        if (slice < 0 || slice >= this.numSlices || x < 0 || x >= this.tilewidth || y < 0 || y >= this.tileheight) {
            // console.warn("Out of bounds in getLoc2Idx:", loc, slice, x, y);
            return [null, null, null]; // out of bounds
        }
        return [slice, x, y];
    }
    getGradValue(slice, x, y) {
        
        if (typeof this.gradientField == "undefined" || slice < 0 || slice >= this.numSlices || y < 0 || y >= this.tilewidth || x < 0 || x >= this.tileheight) {
            return new Vector3(0, 0, 0);
        }
        const idx = (slice * this.tilewidth * this.tileheight + y * this.tileheight + x) * 3;
        return new Vector3(
            this.gradientField[idx],
            this.gradientField[idx + 1],
            this.gradientField[idx + 2]
        );
        
        
        /*        // should we check if we are inside the volume?
        if (slice < 0 || slice >= this.gradientField.length || y < 0 || y >= this.gradientField[0].length || x < 0 || x >= this.gradientField[0][0].length) {
        //console.warn("Out of bounds in getGradValue:", slice, x, y);
        // point towards the center of the volume instead
        return new Vector3(0, 0, 0);
        }
        return this.gradientField[slice][y][x]; // returns a Vector3 
        */
    }
    getValue(slice, x, y) {
        /*        if (slice < 0 || slice >= this.numSlices || y < 0 || y >= this.tilewidth || x < 0 || x >= this.tileheight) {
        return 0;
        }
        return this.scalarField[this.scalarIndex(slice, y, x)];
        */
        
        // some slices are empty, we could not look at those at all if we wanted to
        //var slice = 100;
        //var x = 100;
        //var y = 100;
        
        if (slice < 0 || slice >= this.numSlices || y < 0 || y >= this.tilewidth || x < 0 || x >= this.tileheight) {
            //console.warn("Out of bounds in getValue:", slice, x, y);
            return 0;
        }
        this.tilePerRow = 14;
        // mosaic format, we are at index i,j in the mosaic
        var j = Math.trunc(slice / this.tilePerRow);
        var i = slice - (j * this.tilePerRow);
        // calculate the x and y position in the mosaic
        var mosaicX = (i * this.tilewidth) + x;
        var mosaicY = (j * this.tileheight) + y;
        // get the value from the x and y position in the slice
        var value = this.pixels[(mosaicX + (mosaicY * this.canvas.width)) * 4]; // we only look at one of the channels (should be grayscale)
        if (value == null)
            return 0; // should never happen
        return value; 
    }
}

export { Volume };