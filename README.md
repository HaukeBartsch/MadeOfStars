# Made of Stars: A Multi‑Scale Gradient‑Field Approach to Microscopy Data Visualization

We introduce _Made of Stars_, a novel visualization that fuses flocking algorithms, synchronized firing events, and gradient‑derived force fields to produce dynamic, biologically meaningful depictions of large‑scale microscopy data.

You can reach the live page <a href="https://haukebartsch.github.io/MadeOfStars/?stars=1500">here</a>.

### Examples for different setups

![Example 01](https://github.com/HaukeBartsch/MadeOfStars/raw/main/images/example01.png)

Life page with <a href="https://haukebartsch.github.io/MadeOfStars/?numAgents=4000&channelID1=5&channelID2=6&channelID3=4&enableChannel1=true&enableChannel2=true&enableChannel3=true&DESIRED_SPEED=0.001&TAU_SPEED=0.01&FIRE_CYCLE=1&NUDGE_FACTOR=0&NUDGE_LIMIT=3&CONFUSION_FACTOR=0.2&VISIBLE_RADIUS=0.15&PROTECTED_RADIUS=0.05&FLEE_RADIUS=0.3&HABITAT_RADIUS=1.8&USE_GRID=true&ALIGN_FACTOR=0.02&COHERE_FACTOR=0&AVOID_FACTOR=0.1&FLEE_FACTOR=3.01&HABITAT_FACTOR=0.1&GRADIENT_SCALER=0.5&bodyColor=%23747474&fireColor=%23ef8a62&fireColor2=%23f7f7f7&fireColor3=%2367a9cf&bodySize=0.02&bodyOpacity=0.2&fireR1=0.002&fireR2=0.0001&aspect=1&posx=0.11696538916262103&posy=-0.24231201623329493&posz=1.2150473050569557&qx=0.03896609199627155&qy=0.09955955108445562&qz=-0.684312478860271&qw=0.7213085128698475">4,000 stars using the RdBu colormap</a>.

## Notes

Experiment with the channels and colormap settings using the controls. If you are happy with a visualization you can share a link with your setup using "Copy bookmark".

To adjust the starting number of stars by specifying an initial URL argument like "?stars=1500" or "?numAgents=1500". With patience the authors are able to generate images with up to 10,000 stars.

You can change the large scale firing pattern to twinkling random firings if you first set 'Firing/Nudging' to 0 and press the 'desynchronize' button.

For many stars that are densily clustered you can reduce both 'Firing/Body fire' (0) and 'Firing/Diffuse fire' (0.0005).

There are some keyboard commands for camera movements available to simplify the generation of movies. Try 'a' for anterior, 'i' for inferior and 'l', 'r' for left and right lateral views.