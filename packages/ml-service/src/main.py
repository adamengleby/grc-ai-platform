"""
Minimal ML Service for Local Development
Provides basic ML endpoints for GRC analytics
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import numpy as np
import json
from datetime import datetime

app = FastAPI(title="GRC ML Service", version="0.1.0-local")

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    models_loaded: int

class ModelInfo(BaseModel):
    id: str
    name: str
    type: str
    status: str
    accuracy: float
    version: str

class PredictionRequest(BaseModel):
    tenant_id: str
    model_type: str
    data: Dict[str, Any]

class PredictionResponse(BaseModel):
    prediction: float
    confidence: float
    model_version: str
    timestamp: str

# Mock models registry for local development
MOCK_MODELS = [
    {
        "id": "risk-predictor-local",
        "name": "Risk Prediction Model (Local)",
        "type": "risk_prediction",
        "status": "active",
        "accuracy": 0.847,
        "version": "1.0.0-local"
    },
    {
        "id": "data-quality-local", 
        "name": "Data Quality Checker (Local)",
        "type": "data_quality",
        "status": "active",
        "accuracy": 0.923,
        "version": "1.0.0-local"
    }
]

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        models_loaded=len(MOCK_MODELS)
    )

@app.get("/models", response_model=List[ModelInfo])
async def get_models():
    """Get available ML models"""
    return [ModelInfo(**model) for model in MOCK_MODELS]

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Make ML predictions"""
    
    # Find the appropriate model
    model = next((m for m in MOCK_MODELS if m["type"] == request.model_type), None)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model type '{request.model_type}' not found")
    
    # Generate realistic predictions based on model type
    if request.model_type == "risk_prediction":
        # Risk prediction: score 0-10
        prediction = np.random.normal(6.5, 1.5)
        prediction = max(0, min(10, prediction))  # Clamp to 0-10
        confidence = 0.75 + np.random.random() * 0.2  # 0.75-0.95
        
    elif request.model_type == "data_quality":
        # Data quality: score 0-1
        prediction = 0.7 + np.random.random() * 0.25  # 0.7-0.95
        confidence = 0.8 + np.random.random() * 0.15  # 0.8-0.95
        
    else:
        # Generic prediction
        prediction = np.random.random()
        confidence = 0.6 + np.random.random() * 0.3
    
    return PredictionResponse(
        prediction=round(prediction, 3),
        confidence=round(confidence, 3),
        model_version=model["version"],
        timestamp=datetime.now().isoformat()
    )

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "GRC ML Service",
        "version": "0.1.0-local",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "models": "/models", 
            "predict": "/predict"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3008)