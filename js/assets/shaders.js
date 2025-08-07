function vertexShader() {
    return `
    uniform float fireCycle;
    uniform float size;
    
    uniform float bodySize;
    uniform vec3 bodyColor;
    uniform float bodyOpacity;  
    
    uniform vec3 fireColor;
    uniform vec3 fireColor2;
    uniform vec3 fireColor3;
    uniform float fireR1;
    uniform float fireR2;
    uniform float aspect;
    
    attribute float clock;
    varying float intensity;
    attribute float channel; // even if the channel is int8 it will be converted to float by javascript
    varying vec3 channelColor; 

    void main() {        
        if (clock < 0.2) {
          intensity = exp(-(0.2-clock)/(0.15*fireCycle));
        }
        else {
          intensity = exp(-(clock-0.2)/(0.15*fireCycle));
        }
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        gl_PointSize = size  * ( 600.0 / length( mvPosition.xyz ) );
        gl_Position = projectionMatrix * mvPosition;

        if (channel < 0.5) {
          channelColor = fireColor;
        } else if (channel < 1.5) {
          channelColor = fireColor2;
        } else {
          channelColor = fireColor3;
        }
    }
  `
}
function fragmentShader() {
    return`
    uniform float bodySize;
    uniform vec3 bodyColor;
    uniform float bodyOpacity;  
    
    uniform vec3 fireColor;
    uniform vec3 fireColor2;
    uniform vec3 fireColor3;
    uniform float fireR1;
    uniform float fireR2;
    uniform float aspect;
    
    varying float intensity;
    varying vec3 channelColor; // color based on channel
    
    void main() {
      // Find distance from the centre of the point
      vec2 fragmentPosition = 2.0*gl_PointCoord - 1.0;

      // To compensate for distortion when resizing
      if (aspect > 1.0){
        fragmentPosition.x = fragmentPosition.x*aspect;
      }
      else {
        fragmentPosition.y = fragmentPosition.y/aspect;
      }
      
      float r = length(fragmentPosition);
      
      // Body
      vec4 fragBody = vec4(0, 0, 0, 1.0);
      if (r < bodySize) {
        fragBody = vec4(bodyColor * bodyOpacity, 1.0);
      }
      
      // Body Fire
      float focusedIntensity = 0.0;
      if (r < 0.1){
        focusedIntensity = fireR2 / (r * r) - fireR2 / (0.1 * 0.1);
        focusedIntensity *= 0.5;
      }
      
      vec4 focusedFire = vec4(0, 0, 0, 1.0);
      if (r < 1.0) {
        focusedFire = vec4(channelColor * focusedIntensity * intensity, 1.0); // vec4(bodyColor * focusedIntensity * intensity, 1.0);
      }

      // Diffused Fire
      float diffusedIntensity = fireR1 / r - fireR1 ;

      // Final color
      vec4 diffusedFire = vec4(channelColor * diffusedIntensity * intensity, 1.0);


  
      // Overlap body and fire
      gl_FragColor = fragBody + focusedFire + diffusedFire;
    }
    `
}


export {vertexShader, fragmentShader }
