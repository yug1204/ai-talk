import bpy
import time
import math

# ==========================================
# 1. SETTING UP THE 3D MODEL 
# ==========================================
def create_model():
    # Clear existing objects in the scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    # Create a basic 'body' (Cylinder)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=3, location=(0, 0, 1.5))
    body = bpy.context.object
    body.name = "AI_Girl_Body"

    # Create a basic 'head' (Sphere)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.4, location=(0, 0, 3.4))
    head = bpy.context.object
    head.name = "AI_Girl_Head"
    
    return head

# ==========================================
# 2. ADDING EXPRESSIONS (SHAPE KEYS)
# ==========================================
def setup_expressions(obj):
    # Ensure we have the Basis key first
    if not obj.data.shape_keys:
        obj.shape_key_add(name="Basis")

    # Create the 'Smile' key
    smile_key = obj.shape_key_add(name="Smile")
    
    # Create a 'MouthOpen' key for talking
    mouth_key = obj.shape_key_add(name="MouthOpen")

    return smile_key, mouth_key

# ==========================================
# 3. MAKING HER RESPOND (ANIMATION LOGIC)
# ==========================================
def animate_speaking(smile_key, mouth_key, is_happy=True):
    # This is an example of how you animate the shape keys using Python in Blender.
    # In a full STT/TTS loop, you would map this to audio amplitude (pyttsx3).
    
    if is_happy:
        smile_key.value = 0.8  # 80% Smile
    else:
        smile_key.value = 0.0
        
    # Simulate jaw moving by inserting keyframes over a few frames
    frame = bpy.context.scene.frame_current
    
    # Frame 1: Mouth closed
    mouth_key.value = 0.0
    mouth_key.keyframe_insert("value", frame=frame)
    
    # Frame 5: Mouth open
    mouth_key.value = 0.7
    mouth_key.keyframe_insert("value", frame=frame + 5)
    
    # Frame 10: Mouth closed
    mouth_key.value = 0.0
    mouth_key.keyframe_insert("value", frame=frame + 10)
    
    print("Lip sync animation added to Timeline!")

# --- Main Execution ---
if __name__ == "__main__":
    head_obj = create_model()
    smile_shape, mouth_shape = setup_expressions(head_obj)
    
    # Test the animation function
    animate_speaking(smile_shape, mouth_shape, is_happy=True)
    print("AI Girl Placeholder generated successfully with Expression Keys!")
