# Data preprocessing to create gradient_xx.bin.gz

For data see: https://colab.research.google.com/drive/1hMXNI3dbIM4JTnQ69fgVrsvO3Jq0ZPDo?usp=sharing#scrollTo=pZ0NXwtIZGW2s

We use the vips command line tool (brew install vips) to extract image data from the pyramidal tiff. Here a single image of the volume with size 1000x1000 at the highest resolution, first channel.

```bash
vips crop "Dataset1-LSP13626-melanoma-in-situ.ome.tiff[subifd=-1,page=100]" overview.jpg 5000 2500 1000 1000
```


We use ImageMagick to create tiled mosaics. Such a mosaic image can be compressed more effectively and reduces the amount of data transfers between the webserver and the browser. In order to get the dimensions of the mosaic image we need some image information first.

```bash
vipsheader -f image-information "Dataset1-LSP13626-melanoma-in-situ.ome.tiff[-1]" > image_information.xml
```

The volume size at the highest resolution level is encoded in: SizeX="10908" SizeY="5508" SizeZ="194". The image information also includes the list of stains per channel, e.g. for the Channel:0:4 (Hoechst). Total number of channels is 69, before the next resolution level starts. There are 0 to 4 resolution levels. We can extract an image from the middle of the stack at the highest resolution from channel "Hoechst" (12) with:

```bash
channel=44
i=100
crop=( "6000" "1800" "400" "400" )
vips crop "Dataset1-LSP13626-melanoma-in-situ.ome.tiff[subifd=-1,page=$(( (${channel}*194)+$i ))]" "image`printf '%03d' $i`.png" ${crop[@]}
```


Interesting channels are: CD3 (19), CD20 (27), CD11b (37), CD4 (25) and Catalase (59) (plus Hoechst - 44). Based on the image information the resolutions for each resolution layer are:

 - subifd=2 (1363 x 688)
 - subifd=1 (2727 x 1377)
 - subifd=0 (5454 x 2754)
 - subifd=-1 (10908 x 5508)

Here is the loop we used to create the mosaic images for each channel.

```bash
channels=( 19 27 37 42 25 59 44 )
for channel in "${channels[@]}"; do
  crop=( "6000" "1800" "400" "400" )
  data_dir="data/channel_${channel}"
  if [ ! -d "${data_dir}" ]; then
    mkdir "${data_dir}"
  fi
  for ((i=0; i < 194; ++i)); do
     echo "$i"
     vips crop "Dataset1-LSP13626-melanoma-in-situ.ome.tiff[subifd=-1,page=$(( (${channel}*194)+$i ))]" "${data_dir}/image`printf '%03d' $i`.png" ${crop[@]}
  done
  montage "${data_dir}"/*.png -background black -tile 14x14 -geometry 400x400+0+0 data/channel_${channel}.png
done
```

![A single channel mosaic file](https://github.com/HaukeBartsch/MadeOfStars/raw/main/channel_44.png)

In our initial implementation the gradients where calculated on the client side. It turned out that this took too much time. Converting the computations to webworkers for parallel computation was not reducing the computational cost significantly. In the latest iteration all gradient calculations are done as part of the preprocessing. Only compressed volumetric gradient fields are streamed to the clients now.

Converting a channel_XX.png mosaic image to a gradient_XX.bin.gz (Float32Array) is done using the ./converter/toGradientFile.js tool with:

```bin
# cd converter; npm install
node ./toGradientFile.js ../channel_44.png ../gradient_44.bin
gzip ../gradient_44.bin
```

