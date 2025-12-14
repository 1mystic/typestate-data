import json
import pandas as pd
import numpy as np

# Config
INPUT_FILE = 'output.json'
OUTPUT_FILE = 'typestate_training_data.csv'

def process_keystrokes(session):
    """
    Turns raw event logs into a time-series of features.
    """
    raw_events = session.get('keystrokes', [])
    if not raw_events:
        return []

    processed_features = []
    
    # We sort by time just in case network lag messed up the order
    events = sorted(raw_events, key=lambda x: x['time'])
    
    last_key_time = None
    last_char = None

    for i, event in enumerate(events):
        # We only care about 'down' events for Flight Time (Rhythm)
        if event['type'] != 'down':
            continue

        current_time = event['time']
        char = event.get('char', '')
        
        # Filter out bad mobile data
        if char == 'Unidentified':
            continue

        # Feature 1: Flight Time (Time since last key press)
        flight_time = 0
        if last_key_time is not None:
            flight_time = current_time - last_key_time
            
        # Feature 2: Speed Filter (Remove outliers like pauses > 2s)
        # If flight time > 2000ms, user is thinking/distracted, not "stress typing"
        if flight_time > 2000:
            flight_time = 2000 

        # Feature 3: Digraph (The pair of keys, e.g., "T-H")
        digraph = f"{last_char}-{char}" if last_char else "START"

        # Feature 4: Backspace? (Did they make an error?)
        is_error = 1 if event.get('key') == 'Backspace' else 0

        # Append structured row
        row = {
            'session_id': session['sessionId'],
            'user_agent_type': 'mobile' if 'Android' in session.get('userAgent', '') or 'iPhone' in session.get('userAgent', '') else 'desktop',
            'label': 1 if session['mode'] == 'stressed' else 0, # TARGET VARIABLE
            'char': char,
            'flight_time': flight_time,
            'is_error': is_error,
            'sequence_idx': len(processed_features) # Order in the sentence
        }
        
        processed_features.append(row)
        
        # Update history
        last_key_time = current_time
        last_char = char

    return processed_features

# --- Main Execution ---
print("Loading JSON...")
with open(INPUT_FILE, 'r') as f:
    sessions = json.load(f)

all_data = []
print(f"Processing {len(sessions)} sessions...")

for session in sessions:
    features = process_keystrokes(session)
    all_data.extend(features)

# Convert to DataFrame
df = pd.DataFrame(all_data)

# --- Feature Engineering (The "Novelty") ---
# We don't just want "flight_time", we want "Variance from Mean"
# A stressed person is ERRATIC.
if not df.empty:
    # Calculate rolling variance (window of 5 keystrokes)
    df['flight_time_var'] = df.groupby('session_id')['flight_time'].transform(
        lambda x: x.rolling(window=5).var().fillna(0)
    )
    
    # Normalize flight time (z-score per session to account for fast vs slow typists)
    df['flight_time_norm'] = df.groupby('session_id')['flight_time'].transform(
        lambda x: (x - x.mean()) / (x.std() + 1e-6)
    )

    print("\n--- Data Preview ---")
    print(df[['label', 'char', 'flight_time', 'flight_time_var']].head(10))
    
    print(f"\nTotal Keystrokes Extracted: {len(df)}")
    print(f"Relaxed Samples: {len(df[df['label']==0])}")
    print(f"Stressed Samples: {len(df[df['label']==1])}")

    df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved training data to {OUTPUT_FILE}")
else:
    print("No valid data found in JSON!")