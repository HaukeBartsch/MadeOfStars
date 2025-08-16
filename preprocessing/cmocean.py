
import cmocean
# conda activate cmocean

cmaps = cmocean.cm.cmap_d

# print all colormap names
cmaps.keys()

# one colormap with 3 entries
cm = cmocean.tools.get_dict(cmaps['matter'], N=3)

for colname in cmaps.keys():
    if '_' in colname:
       continue
    cm = cmocean.tools.get_dict(cmaps[colname], N=3)
    
    col1 = '#%02x%02x%02x' % (int(cm['red'][0][2] * 255), int(cm['green'][0][2] * 255), int(cm['blue'][0][2] * 255))
    col2 = '#%02x%02x%02x' % (int(cm['red'][1][2] * 255), int(cm['green'][1][2] * 255), int(cm['blue'][1][2] * 255))
    col3 = '#%02x%02x%02x' % (int(cm['red'][2][2] * 255), int(cm['green'][2][2] * 255), int(cm['blue'][2][2] * 255))

    print('"%s": { "3": [ "%s", "%s", "%s" ] },' % (colname, col1, col2, col3))
    