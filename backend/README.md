# MedSign Backend

## Setup Instructions

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the backend server:**
   ```bash
   python start.py
   ```
   
   Or alternatively:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **API Endpoints:**
   - `GET /` - Health check
   - `POST /beautify` - Text beautification endpoint

## API Usage

### Text Beautification
**Endpoint:** `POST /beautify`

**Request Body:**
```json
{
  "text": "your raw text here"
}
```

**Response:**
```json
{
  "input": "your raw text here",
  "beautified": "Your beautified text here."
}
```

## Model Information
- **Model:** prithivida/grammar_error_correcter_v1
- **Purpose:** Grammar correction and text beautification
- **Input Format:** Raw text from sign language detection (with "gec: " prefix)
- **Output Format:** Grammatically correct, readable text
