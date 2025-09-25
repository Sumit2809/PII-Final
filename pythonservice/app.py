# python-service/app.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import base64
import io
from detectors import detect_pii_from_bytes, redact_bytes
import uvicorn

app = FastAPI(title="PII Detection & Redaction Service")

class DetectRequest(BaseModel):
    file_b64: str
    filename: Optional[str] = "upload"
    # future: additional flags

class DetectResponse(BaseModel):
    summary: dict
    entities: List[dict]

class RedactRequest(BaseModel):
    file_b64: str
    filename: Optional[str] = "upload"
    labels: List[str]            # e.g. ["PAN","NAME"]
    mode: Optional[str] = "black" # "black" or "blur"
    partial: Optional[bool] = False

class RedactResponse(BaseModel):
    file_b64: str
    filename: str

@app.post("/detect", response_model=DetectResponse)
def detect_endpoint(payload: DetectRequest):
    try:
        file_bytes = base64.b64decode(payload.file_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 file: {e}")

    entities, summary = detect_pii_from_bytes(file_bytes, payload.filename)
    return {"summary": summary, "entities": entities}

@app.post("/redact", response_model=RedactResponse)
def redact_endpoint(payload: RedactRequest):
    try:
        file_bytes = base64.b64decode(payload.file_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 file: {e}")

    redacted_bytes, out_name = redact_bytes(
        file_bytes,
        payload.filename,
        labels=[lbl.upper() for lbl in payload.labels],
        mode=payload.mode,
        partial=payload.partial
    )
    out_b64 = base64.b64encode(redacted_bytes).decode("utf-8")
    return {"file_b64": out_b64, "filename": out_name}

if __name__ == "__main__":
    # dev server
    uvicorn.run(app, host="0.0.0.0", port=8000)
