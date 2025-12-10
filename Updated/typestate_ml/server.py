from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
import pandas as pd
import tensorflow as tf
import joblib
from fastapi.middleware.cors import CORSMiddleware
import os

# --- Load the Brains ---
print("Loading Model & Scaler...")
# Models are located in the parent directory relative to this file
MODEL_PATH = '../typestate_model.h5'
SCALER_PATH = '../typestate_scaler.pkl'

if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
    # Fallback for when running from root or if files moved
    if os.path.exists('typestate_model.h5'):
        MODEL_PATH = 'typestate_model.h5'
    if os.path.exists('typestate_scaler.pkl'):
        SCALER_PATH = 'typestate_scaler.pkl'

try:
    model = tf.keras.models.load_model(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    print("AI Ready.")
except Exception as e:
    print(f"FAILED to load model or scaler: {e}")
    # We don't exit here so the server creates the app, but it will likely fail on predict
    model = None
    scaler = None

app = FastAPI()

# Allow your frontend to talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define Input Format
class KeystrokePayload(BaseModel):
    keystrokes: list # List of raw event objects from JS

# --- Feature Engineering (Must match training logic!) ---
def extract_features_from_live_data(raw_events):
    if not raw_events:
        return np.array([])

    processed = []
    events = sorted(raw_events, key=lambda x: x['time'])
    last_time = None
    
    for event in events:
        if event['type'] != 'down': continue
        
        curr_time = event['time']
        
        # Calculate Flight Time
        flight_time = 0
        if last_time is not None:
            flight_time = curr_time - last_time
            if flight_time > 2000: flight_time = 2000 # Clip outliers
            
        processed.append({
            'flight_time': flight_time,
            'flight_time_var': 0, # Placeholder, calculated below
            'is_error': 1 if event.get('key') == 'Backspace' else 0
        })
        last_time = curr_time

    # Create DataFrame to compute Rolling Variance
    df = pd.DataFrame(processed)
    if df.empty: return np.array([])
    
    # Rolling Variance (Window 5)
    df['flight_time_var'] = df['flight_time'].rolling(window=5).var().fillna(0)
    
    # Scale/Normalize (Using the loaded scaler from training!)
    features = df[['flight_time', 'flight_time_var']].values
    
    # Handle scaler not loaded
    if scaler is None:
        raise HTTPException(status_code=500, detail="Scaler not loaded")

    features_scaled = scaler.transform(features) # Normalize
    
    # We also need 'is_error' (not scaled typically, but let's assume raw for now or match training)
    # Note: In training we scaled 2 columns. Let's match that shape.
    # Actually, in training we scaled ['flight_time', 'flight_time_var']. 
    # 'is_error' was passed through? 
    # Let's look at training script: "df[['flight_time', 'flight_time_var']] = scaler..."
    # So 'is_error' is raw 0/1. We need to concatenate.
    
    is_error = df['is_error'].values.reshape(-1, 1)
    final_input = np.hstack((features_scaled, is_error))
    
    return final_input

@app.post("/analyze")
async def analyze_stress(payload: KeystrokePayload):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")

    try:
        # 1. Convert Raw Log -> Features
        features = extract_features_from_live_data(payload.keystrokes)
        
        # 2. Check if we have enough data for the window (Need 20)
        if len(features) < 20:
            return {"score": 0.0, "status": "collecting_data"}
            
        # 3. Take the LAST 20 actions (The most recent window)
        sequence = features[-20:] # Shape (20, 3)
        sequence = np.expand_dims(sequence, axis=0) # Shape (1, 20, 3)
        
        # 4. Predict
        prediction = model.predict(sequence, verbose=0)
        stress_score = float(prediction[0][0]) # 0.0 to 1.0
        
        return {
            "score": stress_score,
            "status": "stressed" if stress_score > 0.6 else "relaxed"
        }
        
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# To Run: uvicorn server:app --reload
