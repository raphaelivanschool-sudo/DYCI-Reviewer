# Renders METANOIA as transparent PNG layers (one per moving part) + pivot JSON for the app.
import bpy, sys, json, math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
argv = sys.argv[sys.argv.index('--') + 1:]
OUT, W, RES = argv[0], float(argv[1]), int(argv[2])
ONLY = argv[3] if len(argv) > 3 else ''
sc = bpy.context.scene
ao = bpy.data.objects['RIG_METANOIA']
if ao.animation_data: ao.animation_data.action = None
for pb in ao.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
c = ao.pose.bones['CTRL_Main']
c['wings_master'] = W; c['wings_open_L'] = 0.0; c['wings_open_R'] = 0.0; c['eye_glow'] = 1.0
sc.frame_set(1); bpy.context.view_layer.update()

for n in ('STAGE_Backdrop', 'Cube'):
    if n in bpy.data.objects: bpy.data.objects[n].hide_render = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = RES
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
try: sc.eevee.taa_render_samples = 64
except Exception: pass

# Camera: long lens, a little above chest height, so boxes show a hint of their tops (depth).
ZC, H = 2.55, 5.5
cd = bpy.data.cameras.new('CAM_App'); cd.lens = 85; cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 36
cam = bpy.data.objects.new('CAM_App', cd); sc.collection.objects.link(cam)
dist = (H / 2) / math.tan(math.atan(18 / 85))
el = math.radians(7)
cam.location = (0, -dist * math.cos(el), ZC + dist * math.sin(el))
cam.rotation_euler = (math.pi / 2 - el, 0, 0)
sc.camera = cam
bpy.context.view_layer.update()

def P(v):
    p = world_to_camera_view(sc, cam, Vector(v)); return [round(p.x, 4), round(1 - p.y, 4)]
def bone(name, tail=False):
    pb = ao.pose.bones[name]; return P(ao.matrix_world @ (pb.tail if tail else pb.head))
def bbox(names):
    pts = []
    for o in bpy.data.objects:
        if o.type == 'MESH' and any(o.name.startswith(n) for n in names):
            dg = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
            pts += [P(dg.matrix_world @ Vector(cn)) for cn in dg.bound_box]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return [min(xs), min(ys), max(xs), max(ys)]

robot = [o for o in bpy.data.objects if o.name.startswith('METANOIA_') and o.type in ('MESH', 'CURVE', 'FONT')]
def grp(o):
    n = o.name[len('METANOIA_'):]
    if 'Visor_LED' in n: return 'eyes'
    for side, t in (('Left', 'L'), ('Right', 'R')):
        if n.startswith(side + 'Wing'): return 'wing' + t
        if n.startswith(side + 'Arm_Upper') or n.startswith(side + 'Arm_Elbow'): return 'upper' + t
        if n.startswith(side + 'Arm_') or n.startswith(side + 'Hand'): return 'lower' + t
    if n == 'Head_Fin': return 'fin'
    if n.startswith('Head') or n == 'Visor': return 'head'
    return 'body'
groups = sorted({grp(o) for o in robot})
info = {
    'res': RES, 'wings': W,
    'pivot': {
        'wingL': bone('wing_root.L'), 'wingR': bone('wing_root.R'),
        'shoulderL': bone('upper_arm.L'), 'shoulderR': bone('upper_arm.R'),
        'elbowL': bone('forearm.L'), 'elbowR': bone('forearm.R'),
        'neck': bone('head'), 'feet': P((0, 0, 0)), 'chest': bone('chest'),
    },
    'box': {'head': bbox(['METANOIA_Head', 'METANOIA_Visor']), 'helmet': bbox(['METANOIA_Head']),
            'visor': bbox(['METANOIA_Visor']), 'ledL': bbox(['METANOIA_Visor_LED_L']), 'ledR': bbox(['METANOIA_Visor_LED_R']),
            'torso': bbox(['METANOIA_Torso']), 'all': bbox(['METANOIA_'])},
}
print('INFO ' + json.dumps(info))
json.dump(info, open(OUT + '/layout.json', 'w'), indent=1)
for g in (['all'] if ONLY == 'all' else groups + ['all']):
    if g == 'eyes': continue
    for o in robot: o.hide_render = not (g == 'all' or grp(o) == g)
    sc.render.filepath = f'{OUT}/{g}.png'
    bpy.ops.render.render(write_still=True)
    print('RENDERED', g)
