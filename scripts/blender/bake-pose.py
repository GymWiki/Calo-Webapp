"""Bakt de pose van een geskind leerling-model in een statisch GLB (zie docs/glb-optimization.md).

Gebruik (met `pip install bpy`):
    python scripts/blender/bake-pose.py <bron.blend> <doel.glb>

Exporteert alle zichtbare meshes met toegepaste modifiers (dus de armature-pose) zonder skin en animaties,
Y-up, in meters. Daarna nog: laagste punt op y=0 en optimaliseren (scripts/optimize-glbs.mts).
"""
import sys

import bpy

source, target = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=source)
bpy.ops.object.select_all(action="DESELECT")

meshes = [obj for obj in bpy.data.objects if obj.type == "MESH" and not obj.hide_render]
if not meshes:
    raise SystemExit(f"Geen zichtbare meshes in {source}")
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]

bpy.ops.export_scene.gltf(
    filepath=target,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_skins=False,
    export_animations=False,
    export_yup=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)
print(f"{len(meshes)} mesh(es) geëxporteerd naar {target}")
