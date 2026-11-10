# METANOIA robot - procedural build for Blender 5.x
# Units: metres. Robot faces -Y. Robot's LEFT side = +X.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix, Quaternion

R = math.radians
ROOT = "METANOIA_Robot"
PREFIXES = ("METANOIA_", "MTN_", "CAM_", "LGT_", "RIG_", "STAGE_")
ACTIONS = ("WINGS_OPEN", "WINGS_CLOSE", "WINGS_SHOWCASE", "IDLE", "WAVE",
           "WING_L_OPEN", "WING_L_CLOSE", "WING_R_OPEN", "WING_R_CLOSE")
SIDES = ((1, "L", "Left"), (-1, "R", "Right"))


# ---------------------------------------------------------------- cleanup
def clean():
    root = bpy.data.collections.get(ROOT)
    if root:
        def rec(c):
            for ch in list(c.children):
                rec(ch)
            for o in list(c.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(c)
        rec(root)
    for a in list(bpy.data.actions):
        if a.name.split(".")[0] in ACTIONS or a.name.startswith("RIG_"):
            bpy.data.actions.remove(a)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures,
                 bpy.data.cameras, bpy.data.lights, bpy.data.materials):
        for d in list(coll):
            if d.name.startswith(PREFIXES) and d.users == 0:
                coll.remove(d)


def new_coll(name, parent):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c


# ---------------------------------------------------------------- materials
def mat(name, base, metal=0.0, rough=0.35, coat=0.0, emit=None, estr=0.0):
    m = bpy.data.materials.new("MTN_" + name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = estr
    m.diffuse_color = (*base, 1)
    return m


def make_materials():
    M = {}
    M["white"] = mat("Armor_White", (0.90, 0.91, 0.93), 0.0, 0.28, 0.6)
    M["silver"] = mat("Armor_Silver", (0.60, 0.64, 0.70), 0.55, 0.30, 0.3)
    M["band"] = mat("Band_DarkBlue", (0.09, 0.14, 0.30), 0.2, 0.35, 0.5)
    M["stripe"] = mat("Leg_Stripe_Blue", (0.10, 0.18, 0.48), 0.1, 0.35, 0.5)
    M["visor"] = mat("Visor_Black", (0.008, 0.009, 0.012), 0.0, 0.15, 1.0)
    M["joint"] = mat("Joint_Dark", (0.05, 0.055, 0.065), 0.4, 0.45)
    M["seam"] = mat("Seam_Dark", (0.12, 0.13, 0.16), 0.0, 0.5)
    M["led"] = mat("LED_Blue", (0.05, 0.2, 0.8), 0.0, 0.3, 0.0, (0.15, 0.45, 1.0), 8.0)
    M["eye"] = mat("LED_Eyes", (0.02, 0.1, 0.6), 0.0, 0.2, 0.0, (0.05, 0.3, 1.0), 5.0)
    M["shlight"] = mat("Shoulder_Light", (1.0, 0.97, 0.9), 0.0, 0.2, 0.5, (1.0, 0.95, 0.85), 6.0)
    M["wing"] = mat("Wing_Panel", (0.86, 0.89, 0.95), 0.25, 0.25, 0.6)
    M["edge_L"] = mat("Wing_Edge_L", (0.3, 0.55, 1.0), 0.0, 0.3, 0.0, (0.15, 0.55, 1.0), 3.0)
    M["edge_R"] = mat("Wing_Edge_R", (0.3, 0.55, 1.0), 0.0, 0.3, 0.0, (0.15, 0.55, 1.0), 3.0)
    M["leaf"] = mat("Emblem_Leaf", (0.12, 0.55, 0.22), 0.0, 0.35, 0.3, (0.5, 1.0, 0.6), 0.6)
    M["flag_b"] = mat("Flag_Blue", (0.0, 0.2, 0.62), 0.0, 0.4)
    M["flag_r"] = mat("Flag_Red", (0.78, 0.06, 0.13), 0.0, 0.4)
    M["flag_w"] = mat("Flag_White", (0.95, 0.95, 0.95), 0.0, 0.4)
    M["flag_y"] = mat("Flag_Yellow", (1.0, 0.78, 0.1), 0.0, 0.4)
    M["text"] = mat("Logo_Text", (0.02, 0.14, 0.55), 0.0, 0.35, 0.3)
    M["stage"] = mat("Stage_Backdrop", (0.50, 0.55, 0.75), 0.0, 0.6)
    return M


# ---------------------------------------------------------------- mesh helpers
def mk_obj(name, bm, material, col, bev=0.0, seg=3, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    me.materials.append(material)
    if bev > 0:
        m = o.modifiers.new("Bevel", "BEVEL")
        m.width = bev
        m.segments = seg
        m.limit_method = "ANGLE"
        m.angle_limit = R(35)
        m.harden_normals = True
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return o


def bm_box(sx, sy, sz, cx, cy, cz):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx + cx, v.co.y * sy + cy, v.co.z * sz + cz))
    return bm


def boxz(name, w, d, z0, z1, material, col, x=0.0, y=0.0, bev=0.02):
    return mk_obj(name, bm_box(w, d, z1 - z0, x, y, (z0 + z1) / 2), material, col, bev)


def box(name, size, center, material, col, bev=0.02):
    return mk_obj(name, bm_box(*size, *center), material, col, bev)


def bm_cyl(r, depth, center, axis="Z", seg=8, bm=None):
    bm = bm or bmesh.new()
    res = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                                radius1=r, radius2=r, depth=depth,
                                matrix=Matrix.Rotation(R(180 / seg), 4, "Z"))
    vs = res["verts"]
    if axis == "Y":
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(R(90), 3, "X"))
    elif axis == "X":
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(R(90), 3, "Y"))
    bmesh.ops.translate(bm, verts=vs, vec=Vector(center))
    return bm


def bm_add_sphere(bm, r, center, scale=(1, 1, 1), rot=None, seg=16):
    res = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2 + 2, radius=r)
    vs = res["verts"]
    for v in vs:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
    if rot is not None:
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=rot)
    bmesh.ops.translate(bm, verts=vs, vec=Vector(center))
    return bm


def bm_poly(pts, a0, a1, plane="XZ"):
    """2D polygon extruded between a0 and a1 along the axis missing from `plane`."""
    bm = bmesh.new()

    def P(p, a):
        if plane == "XZ":
            return (p[0], a, p[1])
        if plane == "YZ":
            return (a, p[0], p[1])
        return (p[0], p[1], a)
    b = [bm.verts.new(P(p, a0)) for p in pts]
    t = [bm.verts.new(P(p, a1)) for p in pts]
    bm.faces.new(b)
    bm.faces.new(list(reversed(t)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((b[i], b[j], t[j], t[i]))
    return bm


def ring(w, d, c):
    hw, hd = w / 2, d / 2
    c = min(c, hw * 0.9, hd * 0.9)
    return [(hw - c, -hd), (hw, -hd + c), (hw, hd - c), (hw - c, hd),
            (-hw + c, hd), (-hw, hd - c), (-hw, -hd + c), (-hw + c, -hd)]


def bm_loft(rings, cx=0.0, cy=0.0, cz=0.0):
    bm = bmesh.new()
    loops = []
    for (z, w, d, c) in rings:
        loops.append([bm.verts.new((cx + x, cy + y, cz + z)) for x, y in ring(w, d, c)])
    bm.faces.new(loops[0])
    bm.faces.new(list(reversed(loops[-1])))
    for a, b in zip(loops, loops[1:]):
        for i in range(8):
            j = (i + 1) % 8
            bm.faces.new((a[i], a[j], b[j], b[i]))
    return bm


# ---------------------------------------------------------------- body
HEAD_Z = 4.00
ARM_X = 0.82
LEG_X = 0.275


def build_head(M, col, parts):
    z0 = HEAD_Z

    def add(o, bone="head"):
        parts.append((o, bone))
        return o
    add(mk_obj("METANOIA_Head", bm_loft([
        (0.00, 0.54, 0.54, 0.10),
        (0.12, 0.62, 0.60, 0.12),
        (0.25, 0.66, 0.62, 0.13),
        (0.48, 0.68, 0.64, 0.14),
        (0.58, 0.62, 0.60, 0.14),
        (0.66, 0.46, 0.48, 0.12),
        (0.70, 0.30, 0.34, 0.08)], 0, 0, z0), M["white"], col, 0.02))
    add(box("METANOIA_Visor", (0.70, 0.36, 0.23), (0, -0.165, z0 + 0.365), M["visor"], col, 0.035))
    for sx, tag in ((1, "L"), (-1, "R")):
        bm = bmesh.new()
        cx = sx * 0.15
        for dx in (-0.063, -0.021, 0.021, 0.063):
            bm_add_sphere(bm, 0.017, (cx + dx, -0.35, z0 + 0.395), seg=12)
        for dx in (-0.042, 0.0, 0.042):
            bm_add_sphere(bm, 0.017, (cx + dx, -0.35, z0 + 0.352), seg=12)
        add(mk_obj(f"METANOIA_Visor_LED_{tag}", bm, M["eye"], col))
    add(mk_obj("METANOIA_Head_Faceplate_Keel",
               bm_poly([(-0.10, -0.25), (0.0, -0.33), (0.10, -0.25)], z0 + 0.02, z0 + 0.25, "XY"),
               M["white"], col, 0.012))
    add(mk_obj("METANOIA_Head_Fin",
               bm_poly([(-0.27, z0 + 0.56), (-0.21, z0 + 0.86), (0.0, z0 + 0.80), (0.22, z0 + 0.62)],
                       -0.03, 0.03, "YZ"), M["silver"], col, 0.015))
    for sx, tag in ((1, "L"), (-1, "R")):
        add(box(f"METANOIA_Head_EarPanel_{tag}", (0.05, 0.26, 0.20), (sx * 0.345, 0.0, z0 + 0.36),
                M["silver"], col, 0.015))
    add(mk_obj("METANOIA_Neck", bm_cyl(0.2, 0.2, (0, 0, z0 - 0.02), seg=16), M["joint"], col, 0.01), "chest")


def build_torso(M, col, parts):
    def add(o, bone):
        parts.append((o, bone))
        return o
    add(boxz("METANOIA_Torso", 1.00, 0.70, 3.44, 3.95, M["white"], col, bev=0.06), "chest")
    add(boxz("METANOIA_Torso_ChestBand", 1.01, 0.71, 3.235, 3.435, M["band"], col, bev=0.02), "chest")
    add(boxz("METANOIA_Torso_ChestLower", 0.98, 0.68, 2.76, 3.23, M["white"], col, bev=0.04), "spine")
    add(boxz("METANOIA_Torso_WaistBand", 0.97, 0.67, 2.625, 2.755, M["band"], col, bev=0.02), "spine")
    add(mk_obj("METANOIA_Torso_WaistChevron",
               bm_poly([(-0.2, 2.765), (0.2, 2.765), (0.0, 2.645)], -0.345, -0.31, "XZ"),
               M["white"], col, 0.008), "spine")
    add(boxz("METANOIA_Pelvis", 1.04, 0.70, 1.95, 2.62, M["white"], col, bev=0.05), "hips")
    add(box("METANOIA_Torso_Seam_Upper", (0.014, 0.012, 0.47), (0, -0.352, 3.695), M["seam"], col, 0.0), "chest")
    add(box("METANOIA_Torso_Seam_Lower", (0.014, 0.012, 0.43), (0, -0.342, 2.995), M["seam"], col, 0.0), "spine")
    add(box("METANOIA_Crotch_Joint", (0.12, 0.40, 0.22), (0, 0, 1.88), M["joint"], col, 0.01), "hips")
    add(box("METANOIA_Wing_Mount", (0.86, 0.10, 0.55), (0, 0.39, 3.35), M["silver"], col, 0.03), "chest")


def build_emblems(M, col, parts):
    def add(o):
        parts.append((o, "chest"))
        return o
    # leaf / lotus emblem (viewer's left = robot's right = -X)
    bm = bmesh.new()
    c = Vector((-0.24, -0.356, 3.66))
    bm_add_sphere(bm, 1.0, c + Vector((0, 0, 0.03)), (0.032, 0.008, 0.075))
    for sx in (1, -1):
        bm_add_sphere(bm, 1.0, c + Vector((sx * 0.045, 0, 0.0)), (0.026, 0.008, 0.06),
                      rot=Matrix.Rotation(R(sx * 45), 3, "Y"))
    bm_add_sphere(bm, 1.0, c + Vector((0, 0, -0.045)), (0.03, 0.008, 0.02))
    add(mk_obj("METANOIA_Emblem_Leaf", bm, M["leaf"], col))
    # Philippine flag (robot's left = +X)
    add(box("METANOIA_Emblem_Flag_Blue", (0.22, 0.008, 0.065), (0.20, -0.355, 3.7125), M["flag_b"], col, 0.0))
    add(box("METANOIA_Emblem_Flag_Red", (0.22, 0.008, 0.065), (0.20, -0.355, 3.6475), M["flag_r"], col, 0.0))
    add(mk_obj("METANOIA_Emblem_Flag_Triangle",
               bm_poly([(0.09, 3.745), (0.09, 3.615), (0.203, 3.68)], -0.362, -0.354, "XZ"),
               M["flag_w"], col, smooth=False))
    add(mk_obj("METANOIA_Emblem_Flag_Sun", bm_cyl(0.016, 0.006, (0.12, -0.364, 3.68), "Y", 16),
               M["flag_y"], col, smooth=False))
    cu = bpy.data.curves.new("METANOIA_Logo_Text", "FONT")
    cu.body = "METANOIA"
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.size = 0.05
    cu.extrude = 0.003
    cu.materials.append(M["text"])
    t = bpy.data.objects.new("METANOIA_Logo_Text", cu)
    t.location = (0.20, -0.358, 3.578)
    t.rotation_euler = (R(90), 0, 0)
    col.objects.link(t)
    add(t)


def build_arm(M, col, parts, s, tag, side):
    x = s * ARM_X

    def add(o, bone):
        parts.append((o, f"{bone}.{tag}"))
        return o
    pad = [(0, 0), (0.58, 0), (0.58, 0.62), (0.42, 0.90), (0, 0.90)]
    add(mk_obj(f"METANOIA_{side}Shoulder",
               bm_poly([(s * (0.46 + px), 3.13 + pz) for px, pz in pad], -0.36, 0.36, "XZ"),
               M["white"], col, 0.06), "shoulder")
    add(mk_obj(f"METANOIA_{side}Shoulder_Band",
               bm_poly([(s * 0.455, 3.23), (s * 1.05, 3.23), (s * 1.05, 3.44), (s * 0.455, 3.44)],
                       -0.37, 0.37, "XZ"), M["band"], col, 0.015), "shoulder")
    add(mk_obj(f"METANOIA_{side}Shoulder_Light", bm_cyl(0.09, 0.03, (s * 0.80, -0.37, 3.72), "Y", 24),
               M["shlight"], col, 0.006), "shoulder")
    add(mk_obj(f"METANOIA_{side}Shoulder_LightRim", bm_cyl(0.115, 0.02, (s * 0.80, -0.362, 3.72), "Y", 24),
               M["silver"], col, 0.006), "shoulder")
    add(mk_obj(f"METANOIA_{side}Shoulder_Joint", bm_cyl(0.12, 0.08, (x, 0, 3.09), seg=16), M["joint"], col, 0.01), "shoulder")
    add(mk_obj(f"METANOIA_{side}Shoulder_JointLED", bm_cyl(0.128, 0.025, (x, 0, 3.075), seg=16), M["led"], col), "shoulder")
    # upper arm
    add(mk_obj(f"METANOIA_{side}Arm_Upper", bm_cyl(0.15, 0.60, (x, 0, 2.76)), M["white"], col, 0.03), "upper_arm")
    for z in (3.02, 2.50):
        add(mk_obj(f"METANOIA_{side}Arm_Upper_Band_{int(z*100)}", bm_cyl(0.158, 0.07, (x, 0, z)), M["band"], col, 0.012), "upper_arm")
    add(mk_obj(f"METANOIA_{side}Arm_Elbow", bm_cyl(0.11, 0.10, (x, 0, 2.405), seg=16), M["joint"], col, 0.01), "upper_arm")
    add(mk_obj(f"METANOIA_{side}Arm_ElbowLED", bm_cyl(0.116, 0.03, (x, 0, 2.405), seg=16), M["led"], col), "upper_arm")
    # forearm
    add(mk_obj(f"METANOIA_{side}Arm_Forearm", bm_cyl(0.145, 0.55, (x, 0, 2.075)), M["white"], col, 0.03), "forearm")
    for z in (2.32, 1.83):
        add(mk_obj(f"METANOIA_{side}Arm_Forearm_Band_{int(z*100)}", bm_cyl(0.153, 0.07, (x, 0, z)), M["band"], col, 0.012), "forearm")
    add(mk_obj(f"METANOIA_{side}Arm_Wrist", bm_cyl(0.09, 0.09, (x, 0, 1.75), seg=16), M["joint"], col, 0.01), "forearm")
    add(mk_obj(f"METANOIA_{side}Arm_WristLED", bm_cyl(0.096, 0.03, (x, 0, 1.75), seg=16), M["led"], col), "forearm")
    # hand: palm faces the body, fingers point down and curl slightly inward
    add(box(f"METANOIA_{side}Hand_Palm", (0.095, 0.22, 0.24), (x, 0, 1.58), M["white"], col, 0.03), "hand")
    bm = bmesh.new()
    for fy, ln in ((-0.08, 0.19), (-0.027, 0.22), (0.027, 0.21), (0.08, 0.17)):
        res_bm = bmesh.new()
        bm_cyl(0.032, ln, (0, 0, -ln / 2), seg=8, bm=res_bm)
        bmesh.ops.rotate(res_bm, verts=res_bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(R(s * 12), 3, "Y"))
        bmesh.ops.translate(res_bm, verts=res_bm.verts, vec=Vector((x, fy, 1.47)))
        me = bpy.data.meshes.new("tmp")
        res_bm.to_mesh(me)
        res_bm.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    add(mk_obj(f"METANOIA_{side}Hand_Fingers", bm, M["white"], col, 0.02), "hand")
    tb = bm_cyl(0.035, 0.15, (0, 0, -0.075), seg=8)
    bmesh.ops.rotate(tb, verts=tb.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(R(-35), 3, "X"))
    bmesh.ops.translate(tb, verts=tb.verts, vec=Vector((x - s * 0.01, -0.10, 1.60)))
    add(mk_obj(f"METANOIA_{side}Hand_Thumb", tb, M["white"], col, 0.02), "hand")


def build_leg(M, col, parts, s, tag, side):
    x = s * LEG_X

    def add(o, bone):
        parts.append((o, f"{bone}.{tag}"))
        return o
    add(boxz(f"METANOIA_{side}Leg_Thigh", 0.49, 0.56, 1.145, 1.97, M["white"], col, x=x, bev=0.04), "thigh")
    add(boxz(f"METANOIA_{side}Leg_Shin", 0.49, 0.56, 0.30, 1.145, M["white"], col, x=x, bev=0.04), "shin")
    add(boxz(f"METANOIA_{side}Leg_Stripe_1", 0.505, 0.575, 1.11, 1.18, M["stripe"], col, x=x, bev=0.012), "thigh")
    add(boxz(f"METANOIA_{side}Leg_Stripe_2", 0.505, 0.575, 0.925, 0.995, M["stripe"], col, x=x, bev=0.012), "shin")
    add(boxz(f"METANOIA_{side}Leg_Stripe_3", 0.505, 0.575, 0.76, 0.83, M["stripe"], col, x=x, bev=0.012), "shin")
    add(boxz(f"METANOIA_{side}Foot", 0.52, 0.80, 0.06, 0.32, M["white"], col, x=x, y=-0.10, bev=0.05), "foot")
    add(boxz(f"METANOIA_{side}Foot_Sole", 0.53, 0.81, 0.0, 0.07, M["band"], col, x=x, y=-0.10, bev=0.02), "foot")


# ---------------------------------------------------------------- wings
# per panel: length, root half-height, tip-top z, tip cut-back, tip-bottom z
PANELS = [
    (2.75, 0.22, 0.06, 0.40, -0.10),
    (2.15, 0.25, 0.05, 0.35, -0.12),
    (1.60, 0.17, 0.04, 0.28, -0.08),
    (1.25, 0.14, 0.03, 0.22, -0.07),
]
PIV_X, PIV_Z = 0.32, 3.30
HUB_Y = 0.57
# degrees below horizontal (fan) and sweep-back, per panel
OPEN = [(8, 12), (26, 10), (44, 8), (60, 6)]
CLOSED = [(90, 0), (91, 0), (92, 0), (93, 0)]


def panel_y(i):
    return 0.48 + (3 - i) * 0.06


def build_wing(M, col, parts, s, tag, side):
    for i, (L, h, tt, cut, tb) in enumerate(PANELS):
        y = panel_y(i)
        pts = [(-0.05, h), (L, tt), (L - cut, tb), (-0.05, -h)]
        wpts = [(s * (PIV_X + px), PIV_Z + pz) for px, pz in pts]
        o = mk_obj(f"METANOIA_{side}Wing_Panel_{i+1}", bm_poly(wpts, y - 0.02, y + 0.02, "XZ"),
                   M["wing"], col, 0.012)
        parts.append((o, f"wing_panel_{i+1}.{tag}"))
        cu = bpy.data.curves.new(f"METANOIA_{side}Wing_Panel_{i+1}_Neon", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = 0.022
        cu.bevel_resolution = 2
        cu.fill_mode = "FULL"
        sp = cu.splines.new("POLY")
        sp.points.add(len(wpts) - 1)
        for k, (px, pz) in enumerate(wpts):
            sp.points[k].co = (px, y, pz, 1)
        cu.materials.append(M[f"edge_{tag}"])
        n = bpy.data.objects.new(f"METANOIA_{side}Wing_Panel_{i+1}_Neon", cu)
        col.objects.link(n)
        parts.append((n, f"wing_panel_{i+1}.{tag}"))
    hub = mk_obj(f"METANOIA_{side}Wing_Hub", bm_cyl(0.17, 0.30, (s * PIV_X, HUB_Y, PIV_Z), "Y", 16),
                 M["silver"], col, 0.02)
    parts.append((hub, f"wing_root.{tag}"))
    cap = mk_obj(f"METANOIA_{side}Wing_HubLight", bm_cyl(0.09, 0.02, (s * PIV_X, HUB_Y + 0.155, PIV_Z), "Y", 16),
                 M[f"edge_{tag}"], col)
    parts.append((cap, f"wing_root.{tag}"))


# ---------------------------------------------------------------- rig
def build_rig(col, parts):
    ad = bpy.data.armatures.new("RIG_METANOIA")
    ao = bpy.data.objects.new("RIG_METANOIA", ad)
    col.objects.link(ao)
    ao.show_in_front = True
    ad.display_type = "OCTAHEDRAL"
    vl = bpy.context.view_layer
    for o in vl.objects:
        o.select_set(False)
    vl.objects.active = ao
    ao.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = ad.edit_bones

    def B(n, h, t, p=None):
        b = eb.new(n)
        b.head, b.tail, b.roll = h, t, 0.0
        if p:
            b.parent = eb[p]
        b.use_deform = False
    B("root", (0, 0, 0), (0, 0.8, 0))
    B("CTRL_Main", (0, 1.5, 4.4), (0, 1.5, 4.9), "root")
    B("hips", (0, 0, 1.95), (0, 0, 2.62), "root")
    B("spine", (0, 0, 2.62), (0, 0, 3.23), "hips")
    B("chest", (0, 0, 3.23), (0, 0, 3.93), "spine")
    B("head", (0, 0, HEAD_Z), (0, 0, HEAD_Z + 0.68), "chest")
    for s, t, _ in SIDES:
        x = s * ARM_X
        B(f"shoulder.{t}", (s * 0.46, 0, 3.5), (x, 0, 3.5), "chest")
        B(f"upper_arm.{t}", (x, 0, 3.09), (x, 0, 2.405), f"shoulder.{t}")
        B(f"forearm.{t}", (x, 0, 2.405), (x, 0, 1.75), f"upper_arm.{t}")
        B(f"hand.{t}", (x, 0, 1.75), (x, 0, 1.30), f"forearm.{t}")
        lx = s * LEG_X
        B(f"thigh.{t}", (lx, 0, 1.97), (lx, 0, 1.145), "hips")
        B(f"shin.{t}", (lx, 0, 1.145), (lx, 0, 0.30), f"thigh.{t}")
        B(f"foot.{t}", (lx, 0, 0.30), (lx, -0.45, 0.15), f"shin.{t}")
        B(f"wing_root.{t}", (s * PIV_X, 0.45, PIV_Z), (s * PIV_X, 0.80, PIV_Z), "chest")
        for i in range(4):
            y = panel_y(i)
            B(f"wing_panel_{i+1}.{t}", (s * PIV_X, y - 0.02, PIV_Z), (s * PIV_X, y + 0.30, PIV_Z), f"wing_root.{t}")
    bpy.ops.object.mode_set(mode="OBJECT")

    # rigid (mechanical) bone parenting - no mesh deformation
    for o, bn in parts:
        b = ad.bones[bn]
        o.parent = ao
        o.parent_type = "BONE"
        o.parent_bone = bn
        pm = ao.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))
        o.matrix_parent_inverse = pm.inverted()

    for pb in ao.pose.bones:
        pb.rotation_mode = "XYZ" if pb.name.startswith("wing_") else "QUATERNION"
    ctrl = ao.pose.bones["CTRL_Main"]
    for k, v, mx, desc in (("wings_master", 0.0, 1.0, "Opens/closes both wings (0 closed, 1 open)"),
                           ("wings_open_L", 0.0, 1.0, "Left wing only"),
                           ("wings_open_R", 0.0, 1.0, "Right wing only"),
                           ("eye_glow", 1.0, 2.0, "Visor LED brightness")):
        ctrl[k] = v
        ctrl.id_properties_ui(k).update(min=0.0, max=mx, soft_min=0.0, soft_max=mx, default=v, description=desc)
    return ao


def add_vars(drv, ao, pairs):
    for vn, prop in pairs:
        v = drv.variables.new()
        v.name = vn
        v.type = "SINGLE_PROP"
        v.targets[0].id_type = "OBJECT"
        v.targets[0].id = ao
        v.targets[0].data_path = f'pose.bones["CTRL_Main"]["{prop}"]'


def build_drivers(ao, M):
    simple = []
    for s, t, _ in SIDES:
        for i in range(4):
            pb = ao.pose.bones[f"wing_panel_{i+1}.{t}"]
            d0 = 0.12 + i * 0.08
            d1 = d0 + 0.55
            for axis, c, o in ((1, CLOSED[i][0], OPEN[i][0]), (2, CLOSED[i][1], OPEN[i][1])):
                fc = pb.driver_add("rotation_euler", axis)
                for m in list(fc.modifiers):
                    fc.modifiers.remove(m)
                d = fc.driver
                d.type = "SCRIPTED"
                add_vars(d, ao, (("s", f"wings_open_{t}"), ("m", "wings_master")))
                d.expression = f"lerp({s*R(c):.5f},{s*R(o):.5f},smoothstep({d0:.3f},{d1:.3f},max(s,m)))"
                simple.append(d.is_simple_expression)
        sock = M[f"edge_{t}"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
        fc = sock.driver_add("default_value")
        d = fc.driver
        d.type = "SCRIPTED"
        add_vars(d, ao, (("s", f"wings_open_{t}"), ("m", "wings_master")))
        d.expression = "1.5+10*smoothstep(0,0.15,max(s,m))"
        simple.append(d.is_simple_expression)
    sock = M["eye"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
    fc = sock.driver_add("default_value")
    d = fc.driver
    d.type = "SCRIPTED"
    add_vars(d, ao, (("e", "eye_glow"),))
    d.expression = "5*e"
    simple.append(d.is_simple_expression)
    return all(simple)


# ---------------------------------------------------------------- actions
def qworld(ao, bone, axis, deg):
    b = ao.data.bones[bone]
    la = (b.matrix_local.to_3x3().inverted() @ Vector(axis)).normalized()
    return Quaternion(la, R(deg))


def reset_pose(ao):
    for pb in ao.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    c = ao.pose.bones["CTRL_Main"]
    c["wings_master"] = 0.0
    c["wings_open_L"] = 0.0
    c["wings_open_R"] = 0.0
    c["eye_glow"] = 1.0


def build_actions(ao):
    ao.animation_data_create()
    ctrl = ao.pose.bones["CTRL_Main"]
    P = ao.pose.bones

    def kp(prop, keys):
        for f, v in keys:
            ctrl[prop] = v
            ctrl.keyframe_insert(f'["{prop}"]', frame=f)

    def kq(bone, keys):
        for f, q in keys:
            P[bone].rotation_quaternion = q
            P[bone].keyframe_insert("rotation_quaternion", frame=f)

    def make(name, fn):
        ao.animation_data.action = None
        reset_pose(ao)
        fn()
        act = ao.animation_data.action
        act.name = name
        act.use_fake_user = True
        return act

    I = Quaternion()
    acts = {}
    acts["WINGS_OPEN"] = make("WINGS_OPEN", lambda: (kp("wings_master", [(1, 0.0), (60, 1.0)]), kp("eye_glow", [(1, 1.0)])))
    acts["WINGS_CLOSE"] = make("WINGS_CLOSE", lambda: (kp("wings_master", [(1, 1.0), (60, 0.0)]), kp("eye_glow", [(1, 1.0)])))

    def showcase():
        kp("wings_master", [(1, 0.0), (20, 0.0), (80, 1.0), (140, 1.0), (200, 0.0), (220, 0.0)])
        kp("eye_glow", [(1, 1.0), (20, 1.0), (40, 1.4), (140, 1.4), (200, 1.0)])
    acts["WINGS_SHOWCASE"] = make("WINGS_SHOWCASE", showcase)

    def idle():
        kq("chest", [(1, I), (25, qworld(ao, "chest", (0, 0, 1), 2)), (49, I),
                     (73, qworld(ao, "chest", (0, 0, 1), -2)), (97, I)])
        kq("head", [(1, I),
                    (25, qworld(ao, "head", (0, 0, 1), 6) @ qworld(ao, "head", (1, 0, 0), -2)),
                    (49, qworld(ao, "head", (1, 0, 0), 2)),
                    (73, qworld(ao, "head", (0, 0, 1), -6) @ qworld(ao, "head", (1, 0, 0), -2)),
                    (97, I)])
        kp("eye_glow", [(1, 1.0), (25, 0.6), (49, 1.0), (73, 0.6), (97, 1.0)])
        kp("wings_master", [(1, 0.0)])
    acts["IDLE"] = make("IDLE", idle)

    def wave():
        ua, fa, hd = "upper_arm.R", "forearm.R", "hand.R"
        up = qworld(ao, ua, (0, 1, 0), 75)
        kq(ua, [(1, I), (16, up), (60, up), (72, I)])
        kq(fa, [(1, I), (16, qworld(ao, fa, (0, 1, 0), 100)), (24, qworld(ao, fa, (0, 1, 0), 122)),
                (32, qworld(ao, fa, (0, 1, 0), 82)), (40, qworld(ao, fa, (0, 1, 0), 122)),
                (48, qworld(ao, fa, (0, 1, 0), 82)), (56, qworld(ao, fa, (0, 1, 0), 100)), (72, I)])
        tw = Quaternion((0, 1, 0), R(90))
        kq(hd, [(1, I), (16, tw), (60, tw), (72, I)])
        kq("head", [(1, I), (16, qworld(ao, "head", (0, 1, 0), 5)), (60, qworld(ao, "head", (0, 1, 0), 5)), (72, I)])
        kp("wings_master", [(1, 0.0)])
        kp("eye_glow", [(1, 1.0)])
    acts["WAVE"] = make("WAVE", wave)

    for t in ("L", "R"):
        acts[f"WING_{t}_OPEN"] = make(f"WING_{t}_OPEN", lambda t=t: (
            kp("wings_master", [(1, 0.0)]), kp(f"wings_open_{t}", [(1, 0.0), (60, 1.0)])))
        acts[f"WING_{t}_CLOSE"] = make(f"WING_{t}_CLOSE", lambda t=t: (
            kp("wings_master", [(1, 0.0)]), kp(f"wings_open_{t}", [(1, 1.0), (60, 0.0)])))

    ao.animation_data.action = None
    reset_pose(ao)
    return acts


def set_action(ao, act):
    ad = ao.animation_data
    ad.action = act
    try:
        if ad.action_slot is None and len(act.slots):
            ad.action_slot = act.slots[0]
    except AttributeError:
        pass


# ---------------------------------------------------------------- stage
def look_at(o, target):
    d = Vector(target) - o.location
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def build_stage(M, col):
    sc = bpy.context.scene
    # cyclorama backdrop
    prof = [(-12.0, 0.0), (3.0, 0.0)]
    for k in range(1, 9):
        a = R(-90 + k * 90 / 8)
        prof.append((3.0 + 3.0 * math.cos(a), 3.0 + 3.0 * math.sin(a)))
    prof.append((6.0, 16.0))
    bm = bmesh.new()
    left = [bm.verts.new((-20, y, z)) for y, z in prof]
    right = [bm.verts.new((20, y, z)) for y, z in prof]
    for k in range(len(prof) - 1):
        bm.faces.new((left[k], right[k], right[k + 1], left[k + 1]))
    st = mk_obj("STAGE_Backdrop", bm, M["stage"], col)
    st.hide_select = True

    # lights
    def area(name, loc, power, size, color, target=(0, 0, 2.4)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = power
        ld.size = size
        ld.color = color
        o = bpy.data.objects.new(name, ld)
        o.location = loc
        look_at(o, target)
        col.objects.link(o)
        return o
    area("LGT_Key", (-4.5, -6.0, 6.5), 900, 4.0, (1.0, 0.97, 0.94))
    area("LGT_Fill", (6.0, -5.0, 3.5), 300, 5.0, (0.85, 0.9, 1.0))
    area("LGT_Rim_Blue", (4.0, 5.0, 5.5), 1200, 3.0, (0.45, 0.6, 1.0))
    area("LGT_Rim_Purple", (-4.5, 4.5, 4.5), 900, 3.0, (0.7, 0.5, 1.0))
    area("LGT_Top", (0.0, 0.0, 9.0), 200, 4.0, (1.0, 1.0, 1.0), (0, 0, 0))

    # cameras
    def cam(name, loc, target, lens=50, ortho=None):
        cd = bpy.data.cameras.new(name)
        if ortho:
            cd.type = "ORTHO"
            cd.ortho_scale = ortho
        else:
            cd.lens = lens
        o = bpy.data.objects.new(name, cd)
        o.location = loc
        look_at(o, target)
        col.objects.link(o)
        return o
    cams = {
        "front": cam("CAM_Front_Ortho", (0, -16, 2.3), (0, 0, 2.3), ortho=7.4),
        "three_quarter": cam("CAM_ThreeQuarter", (8.0, -10.5, 3.6), (0, 0, 2.4), lens=50),
        "full_body": cam("CAM_FullBody", (2.4, -13.5, 1.9), (0, 0, 2.5), lens=42),
    }

    # world + render
    w = bpy.data.worlds.get("MTN_World") or bpy.data.worlds.new("MTN_World")
    try:
        w.use_nodes = True
    except Exception:
        pass
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.75, 0.78, 0.9, 1)
    bg.inputs["Strength"].default_value = 0.3
    sc.world = w
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = 1600
    sc.render.resolution_y = 1200
    sc.render.fps = 24
    sc.frame_start, sc.frame_end = 1, 220
    for attr, val in (("taa_render_samples", 64), ("use_raytracing", True), ("use_shadows", True)):
        try:
            setattr(sc.eevee, attr, val)
        except Exception:
            pass
    try:
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    sc.camera = cams["full_body"]
    return cams


# ---------------------------------------------------------------- main
def build():
    clean()
    sc = bpy.context.scene
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    # keep (but hide) the default startup objects
    for n in ("Cube", "Light"):
        o = bpy.data.objects.get(n)
        if o:
            o.hide_set(True)
            o.hide_render = True
    root = new_coll(ROOT, sc.collection)
    cols = {n: new_coll(f"METANOIA_{n}", root) for n in
            ("Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg", "LeftWing", "RightWing", "Rig")}
    stage = new_coll("METANOIA_Stage_Lights_Cameras", root)
    M = make_materials()
    parts = []
    build_head(M, cols["Head"], parts)
    build_torso(M, cols["Torso"], parts)
    build_emblems(M, cols["Torso"], parts)
    for s, t, side in SIDES:
        build_arm(M, cols[f"{side}Arm"], parts, s, t, side)
        build_leg(M, cols[f"{side}Leg"], parts, s, t, side)
        build_wing(M, cols[f"{side}Wing"], parts, s, t, side)
    ao = build_rig(cols["Rig"], parts)
    simple = build_drivers(ao, M)
    acts = build_actions(ao)
    set_action(ao, acts["WINGS_SHOWCASE"])
    cams = build_stage(M, stage)
    sc.frame_set(1)
    return {"parts": len(parts), "simple_drivers": simple, "actions": list(acts.keys()),
            "cameras": [c.name for c in cams.values()]}
