# TypeState

**Quantifying Cognitive Load through Keystroke Dynamics.**

TypeState is a research project and web application that analyzes typing patterns to detect cognitive stress in real-time. Using an LSTM implementation, it processes keystroke flight times and variability to identify high-stress states and triggers a calming UI intervention.

##  Features

- **Live Data Collection**: Captures keystroke timing data in the browser.
- **Real-time Analysis**: Backend API (FastAPI) processes typing streams.
- **AI Intervention**: Detects stress (>0.6 score) and changes UI to a calming green theme.
- **Privacy Focused**: Data is processed locally/temporarily (unless saved to cloud DB).

## Project Structure

- `site/`: Frontend web application (HTML/JS/CSS).
- `typestate_ml/`: Python backend and ML inference server.
- `typestate_model.h5`: Trained LSTM model (Artefact).
- `typestate_scaler.pkl`: Feature scaler (Artefact).

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js (optional, for web server if needed, though simple HTTP works)

### Installation

1.  **Backend Setup**
    ```bash
    # Create virtual environment (if not exists)
    python -m venv .venv
    
    # Activate source
    # Windows: .venv\Scripts\activate
    # Mac/Linux: source .venv/bin/activate
    
    # Install dependencies
    pip install fastapi uvicorn tensorflow pandas numpy joblib scikit-learn
    ```

2.  **Frontend Setup**
    - The frontend is static HTML/JS. No build step required explicitly, but `firebase-config.js` is needed for cloud features.

### Running the App

1.  **Start the AI Server**
    ```bash
    cd typestate_ml
    uvicorn server:app --reload
    ```
    Server will start at `http://127.0.0.1:8000`.

2.  **Launch the Client**
    - Open `site/index.html` or `site/collector.html` in your browser.
    - Or use a live server (VS Code Live Server extension recommended).

## License

This project is part of academic research.
