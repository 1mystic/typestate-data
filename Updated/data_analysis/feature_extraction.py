import json
import pandas as pd
import numpy as np
import os

def process_keystrokes(file_path):
    print(f"Loading data from {file_path}...")
    
    try:
        with open(file_path, 'r') as f:
            sessions = json.load(f)
    except FileNotFoundError:
        print("File not found. Please ensure sample_data.json exists.")
        return

    features = []

    for session in sessions:
        session_id = session.get('sessionId', 'unknown')
        mode = session.get('mode', 'unknown')
        keystrokes = session.get('keystrokes', [])
        
        # Sort by time just in case
        keystrokes.sort(key=lambda x: x['time'])

        active_keys = {} # Map key_code -> down_timestamp
        last_down_time = None
        last_key = None

        for event in keystrokes:
            key_code = event['key']
            event_type = event['type']
            timestamp = event['time']
            char = event.get('char', '')

            if event_type == 'down':
                # flight time (latency from previous press)
                flight_time = 0
                if last_down_time is not None:
                    flight_time = timestamp - last_down_time
                
                # Record this press for dwell calculation later
                active_keys[key_code] = timestamp
                
                # Update history
                last_down_time = timestamp
                last_key = key_code // 1 # copy?

            elif event_type == 'up':
                if key_code in active_keys:
                    down_time = active_keys.pop(key_code)
                    dwell_time = timestamp - down_time
                    
                    # We record the feature on KeyUp (completion of action) OR KeyDown?
                    # Usually standardized to the KeyDown event, but we only know Dwell at KeyUp.
                    # Let's clean the flow:
                    # We want a sequence of: [Key, Dwell, Flight_Before]
                    
                    # We can't emit purely on Up because we lose the order of "typing".
                    # Better approach: Emit on KeyDown, but Dwell is initially NaN, filled later?
                    # OR: Emit entries for every completed keystroke.
                    
                    features.append({
                        'session_id': session_id,
                        'mode': mode,
                        'key': key_code,
                        'dwell_time': dwell_time,
                        'timestamp': down_time # Use the press time as the event time
                    })

    # Convert to DataFrame
    df_raw = pd.DataFrame(features)
    
    if df_raw.empty:
        print("No features extracted.")
        return

    # Calculate Flight Time (needs to be done on Sorted Press Times)
    # We used 'timestamp' as press time above.
    df_raw = df_raw.sort_values(by=['session_id', 'timestamp'])
    
    # Calculate difference between current row timestamp and previous row timestamp (grouped by session)
    df_raw['flight_time'] = df_raw.groupby('session_id')['timestamp'].diff().fillna(0)
    
    print("\nExtraction Complete.")
    print(df_raw.head(10))
    
    # Statistics per mode
    print("\n--- Statistics by Mode ---")
    stats = df_raw.groupby('mode')[['dwell_time', 'flight_time']].agg(['mean', 'std', 'median'])
    print(stats)
    
    # Save
    output_path = 'processed_features.csv'
    df_raw.to_csv(output_path, index=False)
    print(f"\nSaved features to {output_path}")

if __name__ == "__main__":
    # Use the sample data by default
    process_keystrokes('sample_data.json')
