using UnityEngine;
using System.Collections;

[RequireComponent(typeof(AudioSource))]
public class LipSyncAndMic : MonoBehaviour
{
    [Header("Component References")]
    public SkinnedMeshRenderer characterMesh;
    public AudioSource audioSource;
    private AudioClip micClip;
    
    [Header("Lip Sync Settings")]
    public int mouthOpenBlendShapeIndex = 0; // Find the index of "Mouth_Open" in your SkinnedMeshRenderer
    public float sensitivity = 100f; // Multiplier for the audio volume
    public float smoothingSpeed = 15f; // How fast the mouth moves (Lerp speed)
    public float threshold = 0.01f; // Minimum volume to start moving the mouth
    
    [Header("Microphone Settings")]
    // If you have multiple mics, you might want to change this string to Microphone.devices[x]
    public string overrideMicName = null; 
    private string selectedMic;
    
    // Internal state
    private float currentMouthValue = 0f;
    private float targetMouthValue = 0f;
    private float[] sampleData = new float[256]; // Buffer to read audio data
    private bool isRecording = false;

    void Start()
    {
        if (audioSource == null)
            audioSource = GetComponent<AudioSource>();

        // Set up the microphone
        if (Microphone.devices.Length > 0)
        {
            selectedMic = overrideMicName != null ? overrideMicName : Microphone.devices[0];
            Debug.Log($"Using Microphone: {selectedMic}");
        }
        else
        {
            Debug.LogWarning("No microphone detected!");
        }
    }

    void Update()
    {
        // Example: Press SPACEBAR to start/stop the microphone listening
        if (Input.GetKeyDown(KeyCode.Space))
        {
            if (!isRecording)
                StartListening();
            else
                StopListening();
        }

        // --- 1. CAPTURE AUDIO VOLUME ---
        float averageVolume = 0f;
        
        if (audioSource.isPlaying)
        {
            // Get spectrum data from the playing audio
            audioSource.GetOutputData(sampleData, 0);
            
            // Calculate the average volume of the current frame
            float sum = 0f;
            for (int i = 0; i < sampleData.Length; i++)
            {
                sum += Mathf.Abs(sampleData[i]); // Abs because waveform goes positive and negative
            }
            averageVolume = sum / sampleData.Length;
        }

        // --- 2. MAP TO MESH (The Logic Change) ---
        if (averageVolume > threshold)
        {
            // Target volume scaled by sensitivity (caps out at 100 since blendshapes are 0-100)
            targetMouthValue = Mathf.Clamp(averageVolume * sensitivity, 0f, 100f);
        }
        else
        {
            targetMouthValue = 0f; // Close mouth if it's too quiet
        }

        // --- 3. SMOOTHING (Lerp) ---
        // Smoothly transition from the current mouth state to the target state
        currentMouthValue = Mathf.Lerp(currentMouthValue, targetMouthValue, Time.deltaTime * smoothingSpeed);

        // Apply it to the character mesh
        if (characterMesh != null)
        {
            characterMesh.SetBlendShapeWeight(mouthOpenBlendShapeIndex, currentMouthValue);
        }
    }

    // --- PIPELINE: The Trigger (User Speaks) ---
    public void StartListening()
    {
        if (selectedMic == null) return;
        
        Debug.Log("Microphone Started!");
        isRecording = true;
        
        // Start recording: loop=true, length=10 seconds (buffer), frequency=44100
        micClip = Microphone.Start(selectedMic, true, 10, 44100);
        
        // Optional: Pipe the mic clip into the AudioSource so you can hear yourself (and so GetOutputData works easily)
        // Note: This causes feedback if you aren't wearing headphones!
        // To build a true STT pipeline, you would NOT play it back, you would just send `micClip` to your STT API.
        audioSource.clip = micClip;
        audioSource.loop = true;
        
        // Small delay to let the microphone buffer fill up so the AudioSource doesn't crash
        while (!(Microphone.GetPosition(selectedMic) > 0)) { } 
        audioSource.Play();
    }

    public void StopListening()
    {
        Debug.Log("Microphone Stopped.");
        isRecording = false;
        Microphone.End(selectedMic);
        audioSource.Stop();
        
        // At this point, you would send the recorded audio to your STT (Speech-To-Text) service!
    }
}
