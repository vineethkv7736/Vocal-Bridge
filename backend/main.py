from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

# -----------------------
# Load grammar correction model
# -----------------------
MODEL_NAME = "prithivida/grammar_error_correcter_v1"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)

# -----------------------
# FastAPI app
# -----------------------
app = FastAPI(title="Sign Language Grammar Corrector")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request body
class TextRequest(BaseModel):
    text: str

class StructuredRequest(BaseModel):
    words: list[str]
    context: str = "medical"
    timestamp: str = ""

# Medical word categories for sign language
SYMPTOM_WORDS = ['pain', 'headache', 'fever', 'nausea', 'dizzy', 'tired', 'cough', 'cold', 'flu', 'throat', 'chest', 'breathing', 'stomach', 'back', 'knee', 'shoulder', 'hurt', 'sick', 'bad', 'worse']
TREATMENT_WORDS = ['medication', 'treatment', 'surgery', 'prescription', 'recovery', 'medicine', 'help', 'better']
MEDICAL_PERSONNEL = ['doctor', 'nurse', 'hospital', 'emergency']
BODY_PARTS = ['heart', 'lungs', 'throat', 'blood', 'pressure', 'head', 'body']
ACTION_WORDS = ['need', 'want', 'go', 'get', 'make', 'cannot', 'sleep', 'wake', 'work', 'move', 'walk', 'swallow', 'spin']
TIME_WORDS = ['yesterday', 'today', 'morning', 'night', 'week', 'now', 'start', 'continue']
SEVERITY_WORDS = ['very', 'too', 'much', 'high', 'hard', 'urgent']
LOCATION_WORDS = ['pharmacy', 'hospital', 'emergency', 'room']

def categorize_words(words):
    """Categorize medical words into different types"""
    symptoms = []
    treatments = []
    personnel = []
    body_parts = []
    actions = []
    time_words = []
    severity = []
    locations = []
    
    for word in words:
        if word in SYMPTOM_WORDS:
            symptoms.append(word)
        elif word in TREATMENT_WORDS:
            treatments.append(word)
        elif word in MEDICAL_PERSONNEL:
            personnel.append(word)
        elif word in BODY_PARTS:
            body_parts.append(word)
        elif word in ACTION_WORDS:
            actions.append(word)
        elif word in TIME_WORDS:
            time_words.append(word)
        elif word in SEVERITY_WORDS:
            severity.append(word)
        elif word in LOCATION_WORDS:
            locations.append(word)
    
    return symptoms, treatments, personnel, body_parts, actions, time_words, severity, locations

def create_medical_sentence(words):
    """Create a meaningful medical sentence from detected words"""
    if not words:
        return "No medical signs detected"
    
    # Remove duplicates and limit to 7 words for coherence
    unique_words = list(dict.fromkeys(words))[:7]
    
    # Categorize words
    symptoms, treatments, personnel, body_parts, actions, time_words, severity, locations = categorize_words(unique_words)
    
    # Create sentence based on available word types
    if symptoms and treatments:
        return f"I have {', '.join(symptoms[:3])} and need {', '.join(treatments[:2])}"
    elif symptoms and personnel:
        return f"I have {', '.join(symptoms[:3])} and need to see a {personnel[0]}"
    elif symptoms and body_parts:
        return f"I have {', '.join(symptoms[:2])} in my {', '.join(body_parts[:2])}"
    elif symptoms:
        return f"I am experiencing {', '.join(symptoms[:4])}"
    elif treatments:
        return f"I need {', '.join(treatments[:3])}"
    elif personnel:
        return f"I need to see a {personnel[0]}"
    else:
        # Fallback: use grammar correction model
        return correct_grammar(' '.join(unique_words))

def correct_grammar(text: str) -> str:
    """Use grammar correction model for better sentence formation"""
    input_text = "gec: " + text   # model expects prefix "gec: "
    inputs = tokenizer([input_text], max_length=128, return_tensors="pt", truncation=True)

    with torch.no_grad():
        outputs = model.generate(
            inputs["input_ids"],
            max_length=128,
            num_beams=5,
            early_stopping=True
        )

    return tokenizer.decode(outputs[0], skip_special_tokens=True)

def beautify_sentence(text: str) -> str:
    """Main function to beautify medical sign language text"""
    # Split text into words
    words = text.lower().split()
    
    # Create meaningful medical sentence
    medical_sentence = create_medical_sentence(words)
    
    # Further improve with grammar correction if needed
    if len(words) <= 3:
        return medical_sentence
    else:
        # For longer inputs, use grammar correction to improve the medical sentence
        return correct_grammar(medical_sentence)

def process_structured_words(words: list[str], context: str = "medical") -> str:
    """Process structured word list for better medical sentence formation"""
    if not words:
        return "No medical signs detected"
    
    # Remove duplicates and limit to 7 words for coherence
    unique_words = list(dict.fromkeys(words))[:7]
    
    # Categorize words
    symptoms, treatments, personnel, body_parts, actions, time_words, severity, locations = categorize_words(unique_words)
    
    # Special handling for common sign language patterns
    if len(unique_words) == 3 and 'need' in actions and 'pain' in symptoms:
        # Handle "need pain medication" pattern
        if 'medication' in treatments or 'medicine' in treatments:
            return f"I need medication for pain"
        elif locations:
            return f"I need medication from {locations[0]} for pain"
    
    # Handle "need medication, pharmacy" pattern
    if 'need' in actions and ('medication' in treatments or 'medicine' in treatments) and locations:
        return f"I need medication from {locations[0]}"
    
    # Create more sophisticated medical sentence based on sign language patterns
    if actions and symptoms and personnel:
        return f"I {actions[0]} help for {', '.join(symptoms[:2])} and {actions[0]} to see a {personnel[0]}"
    elif actions and symptoms and treatments:
        return f"I {actions[0]} {', '.join(treatments[:2])} for {', '.join(symptoms[:2])}"
    elif symptoms and treatments and personnel:
        return f"I have {', '.join(symptoms[:2])} and need {', '.join(treatments[:1])} from a {personnel[0]}"
    elif symptoms and treatments:
        return f"I have {', '.join(symptoms[:3])} and need {', '.join(treatments[:2])}"
    elif symptoms and personnel:
        return f"I have {', '.join(symptoms[:3])} and need to see a {personnel[0]}"
    elif symptoms and body_parts:
        return f"I have {', '.join(symptoms[:2])} in my {', '.join(body_parts[:2])}"
    elif actions and symptoms:
        return f"I {actions[0]} help for {', '.join(symptoms[:3])}"
    elif actions and treatments:
        return f"I {actions[0]} {', '.join(treatments[:3])}"
    elif symptoms:
        return f"I am experiencing {', '.join(symptoms[:4])}"
    elif treatments:
        return f"I need {', '.join(treatments[:3])}"
    elif personnel:
        return f"I need to see a {personnel[0]}"
    else:
        # Fallback: use grammar correction model
        return correct_grammar(' '.join(unique_words))

# -----------------------
# API Routes
# -----------------------
@app.get("/")
def root():
    return {"message": "Sign Language Grammar Corrector API is running"}

@app.post("/beautify")
def beautify(req: TextRequest):
    corrected = correct_grammar(req.text)
    return {"input": req.text, "beautified": corrected}

@app.post("/process-words")
def process_words(req: StructuredRequest):
    """Process structured word list for better medical sentence formation"""
    result = process_structured_words(req.words, req.context)
    return {
        "input_words": req.words,
        "context": req.context,
        "beautified": result,
        "word_count": len(req.words),
        "unique_words": list(dict.fromkeys(req.words))
    }
