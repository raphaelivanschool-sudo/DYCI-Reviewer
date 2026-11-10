# METANOIA app pictures

The app's robot (`src/components/Robot.tsx`) uses pictures rendered from
`blender/METANOIA_Robot_3D_Character.blend`. There is one picture per moving part: wings, upper arms, forearms, body, head fin and head.
They live in `assets/robot/`.

## After changing the model

Run from the project folder (Blender 5.x and Python with Pillow):

```bash
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b blender/METANOIA_Robot_3D_Character.blend \
  --python blender/app-export/render_layers.py -- out 0.5 1024
python blender/app-export/pack_layers.py out assets/robot
```

- `0.5` is how far the wings are open, from 0 (closed) to 1 (fully open).
- `1024` is the render size in pixels.
- Create the `out` folder first. It is only scratch space.

Then copy the numbers from `assets/robot/layout.json` into `PART` and `PIVOT` in `Robot.tsx`:
- `layers` holds each picture's place.
- `pivot` holds the joints.
- `box.ledL` / `box.ledR` hold the eye position.

`layout.json` names sides from the robot's point of view: its left (`L`) is the right side of the screen.
