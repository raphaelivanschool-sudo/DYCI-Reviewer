import sys, json
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
lay = json.load(open(src + '/layout.json'))
R = lay['res']; layers = {}
order = ['wingL', 'wingR', 'upperL', 'lowerL', 'upperR', 'lowerR', 'body', 'fin', 'head']
comp = Image.new('RGBA', (R, R))
for n in order:
    im = Image.open(f'{src}/{n}.png').convert('RGBA')
    x0, y0, x1, y1 = im.getchannel('A').point(lambda a: 255 if a > 3 else 0).getbbox()
    x0, y0, x1, y1 = max(0, x0 - 2), max(0, y0 - 2), min(R, x1 + 2), min(R, y1 + 2)
    crop = im.crop((x0, y0, x1, y1))
    crop.save(f'{dst}/robot-{n}.webp', 'WEBP', quality=88, method=6)
    layers[n] = [round(x0 / R, 4), round(y0 / R, 4), round((x1 - x0) / R, 4), round((y1 - y0) / R, 4)]
    comp.alpha_composite(im)
comp.save(src + '/composite.png')
lay['layers'] = layers
json.dump(lay, open(dst + '/layout.json', 'w'), indent=1)
print(json.dumps(layers))
